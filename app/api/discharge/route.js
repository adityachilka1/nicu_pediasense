import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createDischargePlanSchema, updateDischargePlanSchema, updateChecklistItemSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';

// Map lowercase status input to uppercase Prisma enum
function mapStatusToEnum(status) {
  const statusMap = {
    planning: 'PLANNING',
    in_progress: 'IN_PROGRESS',
    ready: 'READY',
    pending_approval: 'PENDING_APPROVAL',
    approved: 'APPROVED',
    discharged: 'DISCHARGED',
    cancelled: 'CANCELLED',
    PLANNING: 'PLANNING',
    IN_PROGRESS: 'IN_PROGRESS',
    READY: 'READY',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    DISCHARGED: 'DISCHARGED',
    CANCELLED: 'CANCELLED',
  };
  return statusMap[status] || status?.toUpperCase();
}

// Map lowercase checklist status to uppercase Prisma enum
function mapChecklistStatusToEnum(status) {
  const statusMap = {
    pending: 'PENDING',
    in_progress: 'IN_PROGRESS',
    completed: 'COMPLETED',
    not_applicable: 'NOT_APPLICABLE',
    deferred: 'DEFERRED',
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    DEFERRED: 'DEFERRED',
  };
  return statusMap[status] || status?.toUpperCase();
}

// Default discharge checklist items by category (using Prisma enum values)
const DEFAULT_CHECKLIST_ITEMS = [
  // Medical criteria (MEDICAL_STABILITY)
  { category: 'MEDICAL_STABILITY', description: 'Stable temperature in open crib for 24+ hours', required: true, orderIndex: 0 },
  { category: 'MEDICAL_STABILITY', description: 'Adequate weight gain (20-30g/day)', required: true, orderIndex: 1 },
  { category: 'MEDICAL_STABILITY', description: 'No apnea/bradycardia events for 5-7 days', required: true, orderIndex: 2 },
  { category: 'MEDICAL_STABILITY', description: 'Off all supplemental oxygen or stable on home O2', required: true, orderIndex: 3 },

  // Feeding & Nutrition (FEEDING_NUTRITION)
  { category: 'FEEDING_NUTRITION', description: 'Full oral feeds or stable on enteral feeds', required: true, orderIndex: 4 },
  { category: 'FEEDING_NUTRITION', description: 'All medications transitioned to home formulations', required: true, orderIndex: 5 },

  // Equipment/DME (EQUIPMENT_DME)
  { category: 'EQUIPMENT_DME', description: 'Home apnea monitor ordered (if needed)', required: false, orderIndex: 1 },
  { category: 'EQUIPMENT_DME', description: 'Home oxygen equipment arranged (if needed)', required: false, orderIndex: 2 },
  { category: 'EQUIPMENT_DME', description: 'Breast pump/feeding supplies provided', required: false, orderIndex: 3 },

  // Car seat safety (CAR_SEAT_SAFETY)
  { category: 'CAR_SEAT_SAFETY', description: 'Car seat test completed (if required)', required: true, orderIndex: 0 },

  // Family Education (FAMILY_EDUCATION)
  { category: 'FAMILY_EDUCATION', description: 'Infant CPR training completed', required: true, orderIndex: 0 },
  { category: 'FAMILY_EDUCATION', description: 'Safe sleep education provided', required: true, orderIndex: 1 },
  { category: 'FAMILY_EDUCATION', description: 'Feeding education completed', required: true, orderIndex: 2 },
  { category: 'FAMILY_EDUCATION', description: 'Medication administration teaching done', required: true, orderIndex: 3 },
  { category: 'FAMILY_EDUCATION', description: 'Warning signs/when to call reviewed', required: true, orderIndex: 4 },

  // Follow-up (FOLLOW_UP)
  { category: 'FOLLOW_UP', description: 'Pediatrician appointment scheduled', required: true, orderIndex: 0 },
  { category: 'FOLLOW_UP', description: 'Specialty follow-up appointments scheduled', required: false, orderIndex: 1 },
  { category: 'FOLLOW_UP', description: 'Early intervention referral made (if needed)', required: false, orderIndex: 2 },
  { category: 'FOLLOW_UP', description: 'Ophthalmology follow-up scheduled (if ROP)', required: false, orderIndex: 3 },

  // Documentation (DOCUMENTATION)
  { category: 'DOCUMENTATION', description: 'Discharge summary completed', required: true, orderIndex: 0 },
  { category: 'DOCUMENTATION', description: 'Prescriptions written', required: true, orderIndex: 1 },
  { category: 'DOCUMENTATION', description: 'Immunization records provided', required: true, orderIndex: 2 },
  { category: 'DOCUMENTATION', description: 'Birth certificate information verified', required: true, orderIndex: 3 },

  // Social Services (SOCIAL_SERVICES)
  { category: 'SOCIAL_SERVICES', description: 'Home safety assessment reviewed', required: true, orderIndex: 0 },
  { category: 'SOCIAL_SERVICES', description: 'Smoke-free environment confirmed', required: true, orderIndex: 1 },
  { category: 'SOCIAL_SERVICES', description: 'Emergency contacts verified', required: true, orderIndex: 2 },
];

// GET /api/discharge - Get discharge plan and checklist for a patient
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

  // Build query filters
  const where = {};

  if (patientId) {
    where.patientId = parseInt(patientId);
  }

  if (status) {
    const mappedStatus = mapStatusToEnum(status);
    const validStatuses = ['PLANNING', 'IN_PROGRESS', 'READY', 'PENDING_APPROVAL', 'APPROVED', 'DISCHARGED', 'CANCELLED'];
    if (validStatuses.includes(mappedStatus)) {
      where.status = mappedStatus;
    }
  }

  // Fetch discharge plan(s)
  const dischargePlans = await prisma.dischargePlan.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          mrn: true,
          name: true,
          gestationalAge: true,
          dayOfLife: true,
          status: true,
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
      checklistItems: {
        orderBy: [
          { category: 'asc' },
          { orderIndex: 'asc' },
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Transform with checklist stats
  const transformed = dischargePlans.map(plan => {
    const items = plan.checklistItems;
    const byCategory = {};

    // Group by category
    items.forEach(item => {
      if (!byCategory[item.category]) {
        byCategory[item.category] = {
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0,
          notApplicable: 0,
          required: 0,
          requiredCompleted: 0,
        };
      }
      byCategory[item.category].total++;
      if (item.required) byCategory[item.category].required++;

      if (item.status === 'COMPLETED') {
        byCategory[item.category].completed++;
        if (item.required) byCategory[item.category].requiredCompleted++;
      } else if (item.status === 'IN_PROGRESS') {
        byCategory[item.category].inProgress++;
      } else if (item.status === 'NOT_APPLICABLE') {
        byCategory[item.category].notApplicable++;
        if (item.required) byCategory[item.category].requiredCompleted++; // N/A counts as done for required
      } else {
        byCategory[item.category].pending++;
      }
    });

    // Calculate readiness score
    const requiredItems = items.filter(i => i.required);
    const completedRequired = requiredItems.filter(i =>
      i.status === 'COMPLETED' || i.status === 'NOT_APPLICABLE'
    ).length;
    const readinessScore = requiredItems.length > 0
      ? Math.round((completedRequired / requiredItems.length) * 100)
      : 0;

    return {
      ...plan,
      checklistStats: {
        total: items.length,
        completed: items.filter(i => i.status === 'COMPLETED').length,
        pending: items.filter(i => i.status === 'PENDING').length,
        inProgress: items.filter(i => i.status === 'IN_PROGRESS').length,
        notApplicable: items.filter(i => i.status === 'NOT_APPLICABLE').length,
        byCategory,
        readinessScore,
      },
    };
  });

  logger.info('Fetched discharge plans', {
    userId: session.user.id,
    patientId,
    count: transformed.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    meta: {
      total: transformed.length,
      categories: ['medical', 'equipment', 'education', 'followup', 'documentation', 'safety'],
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/discharge - Create a discharge plan
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Clinical staff can create discharge plans
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse', 'Physician', 'Charge Nurse', 'Staff Nurse', 'Admin']);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(createDischargePlanSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const {
    patientId,
    estimatedDate,
    disposition,
    primaryCaregiver,
    caregiverPhone,
    specialInstructions,
    followUpPlan,
    checklistItems,
  } = validation.data;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });
  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Check if a discharge plan already exists for this patient
  const existingPlan = await prisma.dischargePlan.findUnique({
    where: { patientId },
  });
  if (existingPlan) {
    throw new ConflictError('A discharge plan already exists for this patient');
  }

  // Create discharge plan with checklist items in a transaction
  const dischargePlan = await prisma.$transaction(async (tx) => {
    // Create the discharge plan
    const plan = await tx.dischargePlan.create({
      data: {
        patientId,
        createdById: parseInt(session.user.id),
        estimatedDate: estimatedDate ? new Date(estimatedDate) : null,
        disposition,
        primaryCaregiver,
        caregiverPhone,
        specialInstructions,
        followUpPlan,
        status: 'PLANNING',
        readinessScore: 0,
      },
    });

    // Use provided checklist items or defaults
    const itemsToCreate = checklistItems && checklistItems.length > 0
      ? checklistItems
      : DEFAULT_CHECKLIST_ITEMS;

    // Create checklist items
    await tx.dischargeChecklistItem.createMany({
      data: itemsToCreate.map(item => ({
        dischargePlanId: plan.id,
        category: item.category,
        description: item.description,
        required: item.required ?? true,
        orderIndex: item.orderIndex ?? 0,
        status: 'PENDING',
      })),
    });

    // Fetch complete plan with items
    return tx.dischargePlan.findUnique({
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
        checklistItems: {
          orderBy: [
            { category: 'asc' },
            { orderIndex: 'asc' },
          ],
        },
      },
    });
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'create_discharge_plan',
      resource: 'discharge_plan',
      resourceId: dischargePlan.id,
      details: JSON.stringify({
        patientId,
        estimatedDate,
        disposition,
        checklistItemCount: dischargePlan.checklistItems.length,
      }),
    },
  });

  logger.audit('Discharge plan created', {
    userId: session.user.id,
    dischargePlanId: dischargePlan.id,
    patientId,
    checklistItemCount: dischargePlan.checklistItems.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({ data: dischargePlan }, { status: 201 });
});

// PUT /api/discharge - Update discharge plan or checklist item
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

  const { dischargePlanId, itemId } = body;

  // Update a specific checklist item
  if (itemId) {
    const validation = validateRequest(updateChecklistItemSchema, {
      status: body.status,
      notes: body.notes,
    });
    if (!validation.success) {
      throw new ValidationError(validation.errors);
    }

    // Find the item
    const existingItem = await prisma.dischargeChecklistItem.findUnique({
      where: { id: parseInt(itemId) },
      include: { dischargePlan: true },
    });

    if (!existingItem) {
      throw new NotFoundError('Checklist item');
    }

    // Update the item - map status to uppercase
    const mappedStatus = mapChecklistStatusToEnum(validation.data.status);
    const updateData = {
      status: mappedStatus,
      notes: validation.data.notes,
    };

    if (mappedStatus === 'COMPLETED') {
      updateData.completedAt = new Date();
      updateData.completedById = parseInt(session.user.id);
    }

    const updatedItem = await prisma.dischargeChecklistItem.update({
      where: { id: parseInt(itemId) },
      data: updateData,
    });

    // Recalculate readiness score
    const allItems = await prisma.dischargeChecklistItem.findMany({
      where: { dischargePlanId: existingItem.dischargePlanId },
    });

    const requiredItems = allItems.filter(i => i.required);
    const completedRequired = requiredItems.filter(i =>
      i.status === 'COMPLETED' || i.status === 'NOT_APPLICABLE'
    ).length;
    const readinessScore = requiredItems.length > 0
      ? Math.round((completedRequired / requiredItems.length) * 100)
      : 0;

    // Update readiness score and potentially status
    const allRequiredComplete = completedRequired === requiredItems.length;
    await prisma.dischargePlan.update({
      where: { id: existingItem.dischargePlanId },
      data: {
        readinessScore,
        status: allRequiredComplete && existingItem.dischargePlan.status === 'PLANNING'
          ? 'READY'
          : existingItem.dischargePlan.status,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'update_checklist_item',
        resource: 'discharge_checklist_item',
        resourceId: updatedItem.id,
        details: JSON.stringify({
          dischargePlanId: existingItem.dischargePlanId,
          previousStatus: existingItem.status,
          newStatus: validation.data.status,
          readinessScore,
        }),
      },
    });

    logger.audit('Discharge checklist item updated', {
      userId: session.user.id,
      itemId: updatedItem.id,
      dischargePlanId: existingItem.dischargePlanId,
      newStatus: validation.data.status,
      readinessScore,
      duration: `${timer.elapsed()}ms`,
    });

    return NextResponse.json({
      data: updatedItem,
      meta: {
        readinessScore,
        allRequiredComplete,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Update the discharge plan itself
  if (!dischargePlanId) {
    throw new ValidationError([{ field: 'dischargePlanId', message: 'Discharge plan ID is required' }]);
  }

  const validation = validateRequest(updateDischargePlanSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  // Find the discharge plan
  const existingPlan = await prisma.dischargePlan.findUnique({
    where: { id: parseInt(dischargePlanId) },
  });

  if (!existingPlan) {
    throw new NotFoundError('Discharge plan');
  }

  // Prepare update data
  const updateData = {};

  if (validation.data.estimatedDate !== undefined) {
    updateData.estimatedDate = validation.data.estimatedDate ? new Date(validation.data.estimatedDate) : null;
  }
  if (validation.data.actualDate !== undefined) {
    updateData.actualDate = validation.data.actualDate ? new Date(validation.data.actualDate) : null;
  }
  if (validation.data.disposition !== undefined) updateData.disposition = validation.data.disposition;
  if (validation.data.primaryCaregiver !== undefined) updateData.primaryCaregiver = validation.data.primaryCaregiver;
  if (validation.data.caregiverPhone !== undefined) updateData.caregiverPhone = validation.data.caregiverPhone;
  if (validation.data.status !== undefined) updateData.status = validation.data.status;
  if (validation.data.readinessScore !== undefined) updateData.readinessScore = validation.data.readinessScore;
  if (validation.data.specialInstructions !== undefined) updateData.specialInstructions = validation.data.specialInstructions;
  if (validation.data.followUpPlan !== undefined) updateData.followUpPlan = validation.data.followUpPlan;

  // If status is discharged, set actual date if not provided
  if (validation.data.status === 'discharged' && !updateData.actualDate) {
    updateData.actualDate = new Date();
  }

  // Update discharge plan
  const updatedPlan = await prisma.dischargePlan.update({
    where: { id: parseInt(dischargePlanId) },
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
      checklistItems: {
        orderBy: [
          { category: 'asc' },
          { orderIndex: 'asc' },
        ],
      },
    },
  });

  // If discharged, update patient status
  if (validation.data.status === 'discharged') {
    await prisma.patient.update({
      where: { id: existingPlan.patientId },
      data: {
        status: 'discharged',
        dischargeDate: updateData.actualDate || new Date(),
      },
    });
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'update_discharge_plan',
      resource: 'discharge_plan',
      resourceId: updatedPlan.id,
      details: JSON.stringify({
        previousStatus: existingPlan.status,
        updates: Object.keys(updateData),
      }),
    },
  });

  logger.audit('Discharge plan updated', {
    userId: session.user.id,
    dischargePlanId: updatedPlan.id,
    patientId: updatedPlan.patientId,
    updates: Object.keys(updateData),
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: updatedPlan,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});
