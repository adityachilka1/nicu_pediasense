import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { updateChecklistItemSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { createAuditLog } from '@/lib/audit';

// PUT /api/discharge/[patientId]/item/[itemId] - Update a checklist item
export const PUT = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Clinical staff can update checklist items
  requireRole(session, ROLE_GROUPS.ALL_CLINICAL);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const patientId = parseInt(params.patientId);
  const itemId = parseInt(params.itemId);

  if (isNaN(patientId)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  if (isNaN(itemId)) {
    throw new ValidationError([{ field: 'itemId', message: 'Invalid item ID' }]);
  }

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(updateChecklistItemSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const { status, notes } = validation.data;

  // Verify discharge plan exists for this patient
  const dischargePlan = await prisma.dischargePlan.findUnique({
    where: { patientId },
    select: { id: true },
  });

  if (!dischargePlan) {
    throw new NotFoundError('Discharge plan');
  }

  // Verify checklist item exists and belongs to this discharge plan
  const existingItem = await prisma.dischargeChecklistItem.findUnique({
    where: { id: itemId },
  });

  if (!existingItem) {
    throw new NotFoundError('Checklist item');
  }

  if (existingItem.dischargePlanId !== dischargePlan.id) {
    throw new ValidationError([{
      field: 'itemId',
      message: 'Checklist item does not belong to this patient\'s discharge plan'
    }]);
  }

  // Prepare update data
  const updateData = {
    status,
    notes,
  };

  // If marking as completed, record who and when
  if (status === 'completed' && existingItem.status !== 'completed') {
    updateData.completedAt = new Date();
    updateData.completedById = parseInt(session.user.id);
  }

  // If status changed from completed to something else, clear completion data
  if (status !== 'completed' && existingItem.status === 'completed') {
    updateData.completedAt = null;
    updateData.completedById = null;
  }

  // Update checklist item
  const updatedItem = await prisma.dischargeChecklistItem.update({
    where: { id: itemId },
    data: updateData,
  });

  // Recalculate readiness score
  const allItems = await prisma.dischargeChecklistItem.findMany({
    where: { dischargePlanId: dischargePlan.id },
  });

  const requiredItems = allItems.filter(item => item.required && item.status !== 'not_applicable');
  const completedRequired = requiredItems.filter(item => item.status === 'completed');
  const readinessScore = requiredItems.length > 0
    ? Math.round((completedRequired.length / requiredItems.length) * 100)
    : 0;

  // Update readiness score on discharge plan
  await prisma.dischargePlan.update({
    where: { id: dischargePlan.id },
    data: { readinessScore },
  });

  // Audit log
  await createAuditLog({
    userId: parseInt(session.user.id),
    action: 'update_discharge_checklist_item',
    resource: 'patient',
    resourceId: patientId,
    details: JSON.stringify({
      itemId,
      previousStatus: existingItem.status,
      newStatus: status,
      description: existingItem.description,
    }),
    ipAddress: clientIP,
  });

  logger.audit('Discharge checklist item updated', {
    userId: session.user.id,
    patientId,
    itemId,
    previousStatus: existingItem.status,
    newStatus: status,
    readinessScore,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...updatedItem,
      readinessScore,
    },
    meta: {
      timestamp: new Date().toISOString(),
      readinessScore,
    },
  });
});

// GET /api/discharge/[patientId]/item/[itemId] - Get a specific checklist item
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const patientId = parseInt(params.patientId);
  const itemId = parseInt(params.itemId);

  if (isNaN(patientId)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  if (isNaN(itemId)) {
    throw new ValidationError([{ field: 'itemId', message: 'Invalid item ID' }]);
  }

  // Verify discharge plan exists for this patient
  const dischargePlan = await prisma.dischargePlan.findUnique({
    where: { patientId },
    select: { id: true },
  });

  if (!dischargePlan) {
    throw new NotFoundError('Discharge plan');
  }

  // Get checklist item
  const item = await prisma.dischargeChecklistItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    throw new NotFoundError('Checklist item');
  }

  if (item.dischargePlanId !== dischargePlan.id) {
    throw new ValidationError([{
      field: 'itemId',
      message: 'Checklist item does not belong to this patient\'s discharge plan'
    }]);
  }

  logger.info('Fetched discharge checklist item', {
    userId: session.user.id,
    patientId,
    itemId,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: item,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});
