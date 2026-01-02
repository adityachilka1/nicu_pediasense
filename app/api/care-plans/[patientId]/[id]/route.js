import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { updateCarePlanSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';

// GET /api/care-plans/[patientId]/[id] - Get a specific care plan
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { patientId, id } = await params;
  const patientIdNum = parseInt(patientId);
  const carePlanId = parseInt(id);

  if (isNaN(patientIdNum) || isNaN(carePlanId)) {
    throw new ValidationError([{ field: 'id', message: 'Invalid ID' }]);
  }

  const carePlan = await prisma.carePlan.findFirst({
    where: {
      id: carePlanId,
      patientId: patientIdNum,
    },
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
      items: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!carePlan) {
    throw new NotFoundError('Care plan');
  }

  // Calculate progress
  const completedCount = carePlan.items.filter(i => i.status === 'completed' || i.status === 'skipped').length;
  const progress = carePlan.items.length > 0 ? Math.round((completedCount / carePlan.items.length) * 100) : 0;

  logger.info('Fetched care plan', {
    userId: session.user.id,
    carePlanId,
    patientId: patientIdNum,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...carePlan,
      goals: carePlan.goals ? JSON.parse(carePlan.goals) : [],
      progress,
    },
  });
});

// PUT /api/care-plans/[patientId]/[id] - Update a care plan
export const PUT = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse']);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const { patientId, id } = await params;
  const patientIdNum = parseInt(patientId);
  const carePlanId = parseInt(id);

  if (isNaN(patientIdNum) || isNaN(carePlanId)) {
    throw new ValidationError([{ field: 'id', message: 'Invalid ID' }]);
  }

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(updateCarePlanSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  // Find existing care plan
  const existingPlan = await prisma.carePlan.findFirst({
    where: {
      id: carePlanId,
      patientId: patientIdNum,
    },
  });

  if (!existingPlan) {
    throw new NotFoundError('Care plan');
  }

  // Prepare update data
  const updateData = {};

  if (validation.data.title !== undefined) updateData.title = validation.data.title;
  if (validation.data.description !== undefined) updateData.description = validation.data.description;
  if (validation.data.priority !== undefined) updateData.priority = validation.data.priority;
  if (validation.data.targetDate !== undefined) {
    updateData.targetDate = validation.data.targetDate ? new Date(validation.data.targetDate) : null;
  }
  if (validation.data.goals !== undefined) {
    updateData.goals = JSON.stringify(validation.data.goals);
  }
  if (validation.data.status !== undefined) {
    updateData.status = validation.data.status;
    if (validation.data.status === 'completed') {
      updateData.completedAt = new Date();
    }
  }

  // Update care plan in transaction
  const updatedPlan = await prisma.$transaction(async (tx) => {
    const plan = await tx.carePlan.update({
      where: { id: carePlanId },
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
    await tx.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'update_care_plan',
        resource: 'care_plan',
        resourceId: carePlanId,
        details: JSON.stringify({
          patientId: patientIdNum,
          previousStatus: existingPlan.status,
          newStatus: validation.data.status || existingPlan.status,
          updates: Object.keys(updateData),
        }),
      },
    });

    return plan;
  });

  logger.audit('Care plan updated', {
    userId: session.user.id,
    carePlanId,
    patientId: patientIdNum,
    updates: Object.keys(updateData),
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...updatedPlan,
      goals: updatedPlan.goals ? JSON.parse(updatedPlan.goals) : [],
    },
  });
});
