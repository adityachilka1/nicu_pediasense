import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { updateCarePlanItemSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireRole } from '@/lib/security';

// PUT /api/care-plans/[patientId]/[id]/task/[taskId] - Update task status
export const PUT = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse']);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const { patientId, id, taskId } = await params;
  const patientIdNum = parseInt(patientId);
  const carePlanId = parseInt(id);
  const taskIdNum = parseInt(taskId);

  if (isNaN(patientIdNum) || isNaN(carePlanId) || isNaN(taskIdNum)) {
    throw new ValidationError([{ field: 'id', message: 'Invalid ID' }]);
  }

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(updateCarePlanItemSchema, {
    status: body.status,
    notes: body.notes,
  });

  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  // Find the task and verify it belongs to the correct care plan and patient
  const existingTask = await prisma.carePlanItem.findFirst({
    where: {
      id: taskIdNum,
      carePlanId: carePlanId,
      carePlan: {
        patientId: patientIdNum,
      },
    },
    include: {
      carePlan: {
        select: {
          id: true,
          title: true,
          patientId: true,
          status: true,
        },
      },
    },
  });

  if (!existingTask) {
    throw new NotFoundError('Care plan task');
  }

  // Map status to Prisma enum
  const statusMap = {
    'pending': 'PENDING',
    'in_progress': 'IN_PROGRESS',
    'completed': 'COMPLETED',
    'skipped': 'SKIPPED',
    'deferred': 'DEFERRED',
  };
  const mappedStatus = statusMap[validation.data.status?.toLowerCase()] || validation.data.status?.toUpperCase();

  // Prepare update data
  const updateData = {
    status: mappedStatus,
  };

  if (validation.data.notes !== undefined) {
    updateData.notes = validation.data.notes;
  }

  if (validation.data.status?.toLowerCase() === 'completed') {
    updateData.completedAt = new Date();
    updateData.completedById = parseInt(session.user.id);
  } else if (validation.data.status?.toLowerCase() === 'pending') {
    // If resetting to pending, clear completion data
    updateData.completedAt = null;
    updateData.completedById = null;
  }

  // Update task in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update the task
    const updatedTask = await tx.carePlanItem.update({
      where: { id: taskIdNum },
      data: updateData,
    });

    // Check if all tasks are completed - use efficient count queries
    const [totalItems, incompleteItems] = await Promise.all([
      tx.carePlanItem.count({
        where: { carePlanId },
      }),
      tx.carePlanItem.count({
        where: {
          carePlanId,
          status: { notIn: ['COMPLETED', 'SKIPPED'] },
        },
      }),
    ]);

    const allCompleted = totalItems > 0 && incompleteItems === 0;

    // Auto-complete care plan if all items are done
    let carePlanCompleted = false;
    if (allCompleted && existingTask.carePlan.status === 'ACTIVE') {
      await tx.carePlan.update({
        where: { id: carePlanId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      carePlanCompleted = true;
    }

    // Create audit log
    await tx.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'update_care_plan_task',
        resource: 'care_plan_item',
        resourceId: taskIdNum,
        details: JSON.stringify({
          carePlanId,
          carePlanTitle: existingTask.carePlan.title,
          patientId: patientIdNum,
          taskDescription: existingTask.description,
          previousStatus: existingTask.status,
          newStatus: validation.data.status,
          carePlanAutoCompleted: carePlanCompleted,
        }),
      },
    });

    return {
      task: updatedTask,
      carePlanCompleted,
      stats: {
        total: totalItems,
        completed: totalItems - incompleteItems,
        remaining: incompleteItems,
      },
    };
  });

  logger.audit('Care plan task updated', {
    userId: session.user.id,
    userName: session.user.name,
    taskId: taskIdNum,
    carePlanId,
    patientId: patientIdNum,
    previousStatus: existingTask.status,
    newStatus: validation.data.status,
    carePlanAutoCompleted: result.carePlanCompleted,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: result.task,
    meta: {
      carePlanCompleted: result.carePlanCompleted,
      stats: result.stats,
      timestamp: new Date().toISOString(),
    },
  });
});
