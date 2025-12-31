import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createPatientSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, AuthenticationError, AuthorizationError, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';

// GET /api/patients - List all patients
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const includeVitals = searchParams.get('includeVitals') === 'true';
  const includeDischarged = searchParams.get('includeDischarged') === 'true';

  // Parse pagination parameters
  const { limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 50,
    maxLimit: 100,
  });

  const where = {};
  if (status && ['normal', 'warning', 'critical'].includes(status)) {
    where.status = status;
  }
  // Only show admitted patients by default unless includeDischarged is true
  if (!includeDischarged) {
    where.dischargeDate = null;
  }

  // Execute query and count in parallel for better performance
  // Use _count for active alarms instead of fetching all alarm records (N+1 fix)
  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: {
        bed: true,
        vitals: includeVitals ? {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        } : false,
        // Use _count instead of fetching all alarms - prevents N+1 queries
        _count: {
          select: {
            alarms: {
              where: { status: 'active' },
            },
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // Critical first
        { bed: { bedNumber: 'asc' } },
      ],
      skip: offset,
      take: limit,
    }),
    prisma.patient.count({ where }),
  ]);

  // Transform to match frontend expected format
  const transformed = patients.map(patient => {
    const latestVitals = patient.vitals?.[0] || {};
    const alarmLimits = patient.alarmLimits ? JSON.parse(patient.alarmLimits) : {};

    return {
      id: patient.id,
      bed: patient.bed?.bedNumber || '--',
      mrn: patient.mrn,
      name: patient.name,
      gender: patient.gender,
      ga: patient.gestationalAge,
      weight: patient.currentWeight,
      birthWeight: patient.birthWeight,
      dol: patient.dayOfLife,
      status: patient.status,
      admitDate: patient.admitDate,
      limits: alarmLimits,
      activeAlarms: patient._count.alarms,
      // Latest vitals
      basePR: latestVitals.heartRate || 0,
      baseSPO2: latestVitals.spo2 || 0,
      baseRR: latestVitals.respRate || 0,
      baseTemp: latestVitals.temperature || 0,
      fio2: latestVitals.fio2 || 21,
    };
  });

  logger.info('Fetched patients', {
    userId: session.user.id,
    count: transformed.length,
    total,
    limit,
    offset,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json(
    createPaginatedResponse({
      data: transformed,
      total,
      limit,
      offset,
    })
  );
});

// POST /api/patients - Create a new patient
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Only charge nurses and above can admit patients
  requireRole(session, ROLE_GROUPS.LEADERSHIP);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(createPatientSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const {
    mrn,
    name,
    dateOfBirth,
    gender,
    gestationalAge,
    birthWeight,
    currentWeight,
    bedNumber,
    alarmLimits,
  } = validation.data;

  // Check for duplicate MRN
  const existingPatient = await prisma.patient.findUnique({
    where: { mrn },
  });
  if (existingPatient) {
    throw new ValidationError([{ field: 'mrn', message: 'Patient with this MRN already exists' }]);
  }

  // Find and validate bed
  let bedId = null;
  if (bedNumber) {
    const bed = await prisma.bed.findUnique({
      where: { bedNumber },
      include: { patient: true },
    });

    if (!bed) {
      throw new ValidationError([{ field: 'bedNumber', message: 'Bed not found' }]);
    }

    if (bed.patient) {
      throw new ValidationError([{ field: 'bedNumber', message: 'Bed is already occupied' }]);
    }

    bedId = bed.id;

    // Update bed status
    await prisma.bed.update({
      where: { id: bed.id },
      data: { status: 'occupied' },
    });
  }

  // Create patient
  const patient = await prisma.patient.create({
    data: {
      mrn,
      name,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      gestationalAge,
      birthWeight,
      currentWeight: currentWeight || birthWeight,
      bedId,
      status: 'normal',
      alarmLimits: alarmLimits ? JSON.stringify(alarmLimits) : null,
    },
    include: {
      bed: true,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'admit_patient',
      resource: 'patient',
      resourceId: patient.id,
      details: JSON.stringify({ mrn, name, bedNumber }),
    },
  });

  logger.audit('Patient admitted', {
    userId: session.user.id,
    patientId: patient.id,
    mrn,
    bedNumber,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({ data: patient }, { status: 201 });
});
