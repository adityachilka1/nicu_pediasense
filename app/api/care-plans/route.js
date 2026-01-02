import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createCarePlanSchema, updateCarePlanSchema, updateCarePlanItemSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';

// GET /api/care-plans - List care plans for a patient
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const includeItems = searchParams.get('includeItems') !== 'false'; // default true

  // Build query filters
  const where = {};

  if (patientId) {
    where.patientId = parseInt(patientId);
  }

  if (status) {
    // Map lowercase to Prisma enum values
    const statusMap = {
      'active': 'ACTIVE',
      'on_hold': 'ON_HOLD',
      'completed': 'COMPLETED',
      'discontinued': 'DISCONTINUED',
      'archived': 'ARCHIVED',
    };
    const mappedStatus = statusMap[status.toLowerCase()];
    if (mappedStatus) {
      where.status = mappedStatus;
    }
  }

  if (category) {
    // Map lowercase to Prisma enum values
    const categoryMap = {
      'respiratory': 'RESPIRATORY',
      'nutrition': 'NUTRITION',
      'neuro': 'NEUROLOGICAL',
      'neurological': 'NEUROLOGICAL',
      'infection': 'INFECTION',
      'growth': 'GROWTH_DEVELOPMENT',
      'growth_development': 'GROWTH_DEVELOPMENT',
      'skin': 'SKIN_WOUND',
      'skin_wound': 'SKIN_WOUND',
      'family': 'FAMILY_SUPPORT',
      'family_support': 'FAMILY_SUPPORT',
      'pain': 'PAIN_MANAGEMENT',
      'pain_management': 'PAIN_MANAGEMENT',
      'developmental': 'DEVELOPMENTAL',
      'discharge': 'DISCHARGE_PLANNING',
      'discharge_planning': 'DISCHARGE_PLANNING',
      'other': 'OTHER',
    };
    const mappedCategory = categoryMap[category.toLowerCase()];
    if (mappedCategory) {
      where.category = mappedCategory;
    }
  }

  // Fetch care plans with optimized includes
  const carePlans = await prisma.carePlan.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          mrn: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          fullName: true,
          initials: true,
          role: true,
        },
      },
      items: includeItems ? {
        orderBy: { createdAt: 'asc' },
      } : false,
      // Use _count for item totals - more efficient than fetching all items
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: [
      { priority: 'asc' }, // high first
      { createdAt: 'desc' },
    ],
  });

  // If itemStats are needed, batch fetch status counts for all care plans at once
  // This is more efficient than computing in JS or making separate queries per plan
  let itemStatsByPlan = {};
  if (includeItems && carePlans.length > 0) {
    const carePlanIds = carePlans.map(p => p.id);

    // Single query to get item status counts grouped by carePlanId and status
    const statusCounts = await prisma.carePlanItem.groupBy({
      by: ['carePlanId', 'status'],
      where: {
        carePlanId: { in: carePlanIds },
      },
      _count: true,
    });

    // Build a lookup map for O(1) access
    for (const row of statusCounts) {
      if (!itemStatsByPlan[row.carePlanId]) {
        itemStatsByPlan[row.carePlanId] = {
          total: 0,
          pending: 0,
          in_progress: 0,
          completed: 0,
          skipped: 0,
        };
      }
      itemStatsByPlan[row.carePlanId][row.status] = row._count;
      itemStatsByPlan[row.carePlanId].total += row._count;
    }
  }

  // Transform care plans with parsed JSON goals
  const transformed = carePlans.map(plan => ({
    ...plan,
    goals: plan.goals ? JSON.parse(plan.goals) : [],
    items: includeItems ? plan.items : undefined,
    _count: undefined, // Remove internal _count from response
    itemStats: includeItems ? {
      total: itemStatsByPlan[plan.id]?.total || 0,
      pending: itemStatsByPlan[plan.id]?.pending || 0,
      inProgress: itemStatsByPlan[plan.id]?.in_progress || 0,
      completed: itemStatsByPlan[plan.id]?.completed || 0,
      skipped: itemStatsByPlan[plan.id]?.skipped || 0,
    } : undefined,
  }));

  // Get category summary
  const categorySummary = await prisma.carePlan.groupBy({
    by: ['category'],
    where: patientId ? { patientId: parseInt(patientId), status: 'ACTIVE' } : { status: 'ACTIVE' },
    _count: true,
  });

  logger.info('Fetched care plans', {
    userId: session.user.id,
    patientId,
    count: transformed.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    meta: {
      total: transformed.length,
      categorySummary: categorySummary.reduce((acc, item) => {
        acc[item.category] = item._count;
        return acc;
      }, {}),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/care-plans - Create a new care plan
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Clinical staff can create care plans
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse', 'Physician', 'Charge Nurse', 'Staff Nurse', 'Admin']);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(createCarePlanSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const {
    patientId,
    title,
    category,
    description,
    goals,
    priority,
    targetDate,
    items,
  } = validation.data;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });
  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Map lowercase values to Prisma enums
  const categoryMap = {
    'respiratory': 'RESPIRATORY',
    'nutrition': 'NUTRITION',
    'neuro': 'NEUROLOGICAL',
    'neurological': 'NEUROLOGICAL',
    'infection': 'INFECTION',
    'growth': 'GROWTH_DEVELOPMENT',
    'growth_development': 'GROWTH_DEVELOPMENT',
    'skin': 'SKIN_WOUND',
    'skin_wound': 'SKIN_WOUND',
    'family': 'FAMILY_SUPPORT',
    'family_support': 'FAMILY_SUPPORT',
    'pain': 'PAIN_MANAGEMENT',
    'pain_management': 'PAIN_MANAGEMENT',
    'developmental': 'DEVELOPMENTAL',
    'discharge': 'DISCHARGE_PLANNING',
    'discharge_planning': 'DISCHARGE_PLANNING',
    'other': 'OTHER',
  };

  const priorityMap = {
    'high': 'HIGH',
    'medium': 'MEDIUM',
    'low': 'LOW',
  };

  const mappedCategory = categoryMap[category?.toLowerCase()] || 'OTHER';
  const mappedPriority = priorityMap[priority?.toLowerCase()] || 'MEDIUM';

  // Create care plan with items in a transaction
  const carePlan = await prisma.$transaction(async (tx) => {
    // Create the care plan
    const plan = await tx.carePlan.create({
      data: {
        patientId,
        createdById: parseInt(session.user.id),
        title,
        category: mappedCategory,
        description,
        goals: goals ? JSON.stringify(goals) : null,
        priority: mappedPriority,
        status: 'ACTIVE',
        targetDate: targetDate ? new Date(targetDate) : null,
      },
    });

    // Create items if provided
    if (items && items.length > 0) {
      const itemTypeMap = {
        'task': 'TASK',
        'assessment': 'ASSESSMENT',
        'intervention': 'INTERVENTION',
        'education': 'EDUCATION',
        'monitoring': 'MONITORING',
        'consultation': 'CONSULTATION',
      };

      await tx.carePlanItem.createMany({
        data: items.map((item, index) => ({
          carePlanId: plan.id,
          description: item.description,
          itemType: itemTypeMap[item.itemType?.toLowerCase()] || 'TASK',
          frequency: item.frequency,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          status: 'PENDING',
        })),
      });
    }

    // Fetch complete plan with items
    return tx.carePlan.findUnique({
      where: { id: plan.id },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            initials: true,
            role: true,
          },
        },
        items: true,
      },
    });
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'create_care_plan',
      resource: 'care_plan',
      resourceId: carePlan.id,
      details: JSON.stringify({
        patientId,
        category,
        title,
        itemCount: items?.length || 0,
      }),
    },
  });

  logger.audit('Care plan created', {
    userId: session.user.id,
    carePlanId: carePlan.id,
    patientId,
    category,
    itemCount: items?.length || 0,
    duration: `${timer.elapsed()}ms`,
  });

  // Transform response
  const response = {
    ...carePlan,
    goals: carePlan.goals ? JSON.parse(carePlan.goals) : [],
  };

  return NextResponse.json({ data: response }, { status: 201 });
});

// PUT /api/care-plans - Update care plan or care plan item
export const PUT = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse', 'Physician', 'Charge Nurse', 'Staff Nurse', 'Admin']);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const { carePlanId, itemId } = body;

  // Update a specific item
  if (itemId) {
    const validation = validateRequest(updateCarePlanItemSchema, {
      status: body.status,
      notes: body.notes,
    });
    if (!validation.success) {
      throw new ValidationError(validation.errors);
    }

    // Find the item
    const existingItem = await prisma.carePlanItem.findUnique({
      where: { id: parseInt(itemId) },
      include: { carePlan: true },
    });

    if (!existingItem) {
      throw new NotFoundError('Care plan item');
    }

    // Map status to Prisma enum
    const itemStatusMap = {
      'pending': 'PENDING',
      'in_progress': 'IN_PROGRESS',
      'completed': 'COMPLETED',
      'skipped': 'SKIPPED',
      'deferred': 'DEFERRED',
    };
    const mappedItemStatus = itemStatusMap[validation.data.status?.toLowerCase()] || validation.data.status?.toUpperCase();

    // Update the item
    const updateData = {
      status: mappedItemStatus,
      notes: validation.data.notes,
    };

    if (validation.data.status?.toLowerCase() === 'completed') {
      updateData.completedAt = new Date();
      updateData.completedById = parseInt(session.user.id);
    }

    const updatedItem = await prisma.carePlanItem.update({
      where: { id: parseInt(itemId) },
      data: updateData,
    });

    // Check if all items are completed using count queries instead of fetching all items (N+1 fix)
    // This uses 2 count queries instead of fetching potentially hundreds of item records
    const [totalItems, incompleteItems] = await Promise.all([
      prisma.carePlanItem.count({
        where: { carePlanId: existingItem.carePlanId },
      }),
      prisma.carePlanItem.count({
        where: {
          carePlanId: existingItem.carePlanId,
          status: { notIn: ['COMPLETED', 'SKIPPED'] },
        },
      }),
    ]);

    const allCompleted = totalItems > 0 && incompleteItems === 0;

    // Auto-complete care plan if all items are done
    if (allCompleted) {
      await prisma.carePlan.update({
        where: { id: existingItem.carePlanId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'update_care_plan_item',
        resource: 'care_plan_item',
        resourceId: updatedItem.id,
        details: JSON.stringify({
          carePlanId: existingItem.carePlanId,
          previousStatus: existingItem.status,
          newStatus: validation.data.status,
        }),
      },
    });

    logger.audit('Care plan item updated', {
      userId: session.user.id,
      itemId: updatedItem.id,
      carePlanId: existingItem.carePlanId,
      newStatus: validation.data.status,
      duration: `${timer.elapsed()}ms`,
    });

    return NextResponse.json({
      data: updatedItem,
      meta: {
        carePlanCompleted: allCompleted,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Update the care plan itself
  if (!carePlanId) {
    throw new ValidationError([{ field: 'carePlanId', message: 'Care plan ID is required' }]);
  }

  const validation = validateRequest(updateCarePlanSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  // Find the care plan
  const existingPlan = await prisma.carePlan.findUnique({
    where: { id: parseInt(carePlanId) },
  });

  if (!existingPlan) {
    throw new NotFoundError('Care plan');
  }

  // Maps for enum values
  const planPriorityMap = {
    'high': 'HIGH',
    'medium': 'MEDIUM',
    'low': 'LOW',
  };
  const planStatusMap = {
    'active': 'ACTIVE',
    'on_hold': 'ON_HOLD',
    'completed': 'COMPLETED',
    'discontinued': 'DISCONTINUED',
    'archived': 'ARCHIVED',
  };

  // Prepare update data
  const updateData = {};

  if (validation.data.title !== undefined) updateData.title = validation.data.title;
  if (validation.data.description !== undefined) updateData.description = validation.data.description;
  if (validation.data.priority !== undefined) {
    updateData.priority = planPriorityMap[validation.data.priority?.toLowerCase()] || validation.data.priority?.toUpperCase();
  }
  if (validation.data.targetDate !== undefined) {
    updateData.targetDate = validation.data.targetDate ? new Date(validation.data.targetDate) : null;
  }
  if (validation.data.goals !== undefined) {
    updateData.goals = JSON.stringify(validation.data.goals);
  }
  if (validation.data.status !== undefined) {
    updateData.status = planStatusMap[validation.data.status?.toLowerCase()] || validation.data.status?.toUpperCase();
    if (validation.data.status?.toLowerCase() === 'completed') {
      updateData.completedAt = new Date();
    }
  }

  // Update care plan
  const updatedPlan = await prisma.carePlan.update({
    where: { id: parseInt(carePlanId) },
    data: updateData,
    include: {
      patient: {
        select: {
          id: true,
          mrn: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          fullName: true,
          initials: true,
        },
      },
      items: true,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'update_care_plan',
      resource: 'care_plan',
      resourceId: updatedPlan.id,
      details: JSON.stringify({
        previousStatus: existingPlan.status,
        updates: Object.keys(updateData),
      }),
    },
  });

  logger.audit('Care plan updated', {
    userId: session.user.id,
    carePlanId: updatedPlan.id,
    patientId: updatedPlan.patientId,
    updates: Object.keys(updateData),
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...updatedPlan,
      goals: updatedPlan.goals ? JSON.parse(updatedPlan.goals) : [],
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});
