import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createMilestoneSchema, updateMilestoneSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { createAuditLog } from '@/lib/audit';

// Map lowercase milestone types to Prisma MilestoneType enum values
function mapMilestoneTypeToEnum(milestoneType) {
  const typeMap = {
    'first_breath': 'FIRST_BREATH',
    'off_oxygen': 'OFF_OXYGEN',
    'first_feed': 'FIRST_ORAL_FEED',
    'first_bottle': 'FIRST_ORAL_FEED',
    'first_breastfeed': 'DIRECT_BREASTFEED',
    'kangaroo_care': 'KANGAROO_CARE',
    'weight_gain': 'REACHED_BIRTH_WEIGHT',
    'phototherapy_complete': 'OTHER',
    'extubation': 'EXTUBATION',
    'discharge_ready': 'OTHER',
    'custom': 'CUSTOM',
    // Also accept uppercase values
    'FIRST_BREATH': 'FIRST_BREATH',
    'OFF_OXYGEN': 'OFF_OXYGEN',
    'FIRST_ORAL_FEED': 'FIRST_ORAL_FEED',
    'DIRECT_BREASTFEED': 'DIRECT_BREASTFEED',
    'KANGAROO_CARE': 'KANGAROO_CARE',
    'REACHED_BIRTH_WEIGHT': 'REACHED_BIRTH_WEIGHT',
    'EXTUBATION': 'EXTUBATION',
    'CUSTOM': 'CUSTOM',
    'OTHER': 'OTHER',
  };
  return typeMap[milestoneType] || 'CUSTOM';
}

// GET /api/family/milestones/[patientId] - Get milestones for a patient
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // In Next.js 15, params is a Promise
  const resolvedParams = await params;
  const patientId = parseInt(resolvedParams.patientId);
  if (isNaN(patientId)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      gestationalAge: true,
      dayOfLife: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  const { searchParams } = new URL(request.url);
  const shared = searchParams.get('shared');
  const milestoneType = searchParams.get('milestoneType');

  // Parse pagination
  const { limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 50,
    maxLimit: 100,
  });

  // Build query filters
  const where = { patientId };

  if (shared !== null && shared !== undefined) {
    where.shared = shared === 'true';
  }

  if (milestoneType) {
    where.milestoneType = milestoneType;
  }

  // Execute query
  const [milestones, total] = await Promise.all([
    prisma.milestone.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.milestone.count({ where }),
  ]);

  // Audit log for PHI access
  await createAuditLog({
    userId: parseInt(session.user.id),
    action: 'view_milestones',
    resource: 'patient',
    resourceId: patientId,
    details: JSON.stringify({ milestoneCount: milestones.length }),
    ipAddress: clientIP,
  });

  logger.info('Fetched patient milestones', {
    userId: session.user.id,
    patientId,
    milestoneCount: milestones.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json(
    createPaginatedResponse({
      data: milestones.map(m => ({
        ...m,
        patient: patient.name,
      })),
      total,
      limit,
      offset,
      additionalMeta: {
        patientId,
        patientName: patient.name,
        milestoneTypes: [
          'first_breath',
          'off_oxygen',
          'first_feed',
          'first_bottle',
          'first_breastfeed',
          'kangaroo_care',
          'weight_gain',
          'phototherapy_complete',
          'extubation',
          'discharge_ready',
          'custom',
        ],
      },
    })
  );
});

// POST /api/family/milestones/[patientId] - Create a new milestone
export const POST = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Clinical staff can create milestones
  requireRole(session, ROLE_GROUPS.ALL_CLINICAL);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // In Next.js 15, params is a Promise
  const resolvedParams = await params;
  const patientId = parseInt(resolvedParams.patientId);
  if (isNaN(patientId)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput({ ...rawBody, patientId });

  const validation = validateRequest(createMilestoneSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const { event, milestoneType, date, shared, notes } = validation.data;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, name: true },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Map milestone type to Prisma enum value
  const mappedMilestoneType = mapMilestoneTypeToEnum(milestoneType);

  // Create milestone
  const milestone = await prisma.milestone.create({
    data: {
      patientId,
      createdById: parseInt(session.user.id),
      event,
      milestoneType: mappedMilestoneType,
      date: new Date(date),
      shared,
      notes,
    },
  });

  // Audit log
  await createAuditLog({
    userId: parseInt(session.user.id),
    action: 'create_milestone',
    resource: 'patient',
    resourceId: patientId,
    details: JSON.stringify({
      milestoneId: milestone.id,
      milestoneType,
      event,
      shared,
    }),
    ipAddress: clientIP,
  });

  logger.audit('Milestone created', {
    userId: session.user.id,
    patientId,
    milestoneId: milestone.id,
    milestoneType,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...milestone,
      patient: patient.name,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }, { status: 201 });
});

// PUT /api/family/milestones/[patientId] - Update a milestone
export const PUT = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Clinical staff can update milestones
  requireRole(session, ROLE_GROUPS.ALL_CLINICAL);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // In Next.js 15, params is a Promise
  const resolvedParams = await params;
  const patientId = parseInt(resolvedParams.patientId);
  if (isNaN(patientId)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const { milestoneId, ...updateData } = body;

  if (!milestoneId) {
    throw new ValidationError([{ field: 'milestoneId', message: 'Milestone ID is required' }]);
  }

  const validation = validateRequest(updateMilestoneSchema, updateData);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  // Verify milestone exists and belongs to patient
  const existingMilestone = await prisma.milestone.findUnique({
    where: { id: parseInt(milestoneId) },
  });

  if (!existingMilestone) {
    throw new NotFoundError('Milestone');
  }

  if (existingMilestone.patientId !== patientId) {
    throw new ValidationError([{
      field: 'milestoneId',
      message: 'Milestone does not belong to this patient'
    }]);
  }

  // Update milestone
  const milestone = await prisma.milestone.update({
    where: { id: parseInt(milestoneId) },
    data: validation.data,
  });

  // Audit log
  await createAuditLog({
    userId: parseInt(session.user.id),
    action: 'update_milestone',
    resource: 'patient',
    resourceId: patientId,
    details: JSON.stringify({
      milestoneId: milestone.id,
      changes: Object.keys(validation.data),
    }),
    ipAddress: clientIP,
  });

  logger.audit('Milestone updated', {
    userId: session.user.id,
    patientId,
    milestoneId: milestone.id,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: milestone,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});
