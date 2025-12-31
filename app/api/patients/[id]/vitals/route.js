import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createVitalsSchema, validateRequest, schemas } from '@/lib/validation';
import { withErrorHandler, NotFoundError, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { z } from 'zod';

// Query params schema for GET
const vitalsQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24), // 1 hour to 7 days
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

// GET /api/patients/[id]/vitals - Get vitals history for a patient
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { id } = await params;

  // Validate patient ID
  const idValidation = schemas.idString.safeParse(id);
  if (!idValidation.success) {
    throw new ValidationError([{ field: 'id', message: 'Invalid patient ID' }]);
  }

  const patientId = parseInt(id);
  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryResult = vitalsQuerySchema.safeParse({
    hours: searchParams.get('hours'),
    limit: searchParams.get('limit'),
  });

  const { hours } = queryResult.success ? queryResult.data : { hours: 24 };

  // Parse pagination parameters (separate from hours/limit in query schema)
  const { limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 500,
    maxLimit: 1000, // Higher limit for time-series data
  });

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  const since = new Date();
  since.setHours(since.getHours() - hours);

  const where = {
    patientId,
    recordedAt: {
      gte: since,
    },
  };

  // Execute query and count in parallel
  const [vitals, total] = await Promise.all([
    prisma.vital.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.vital.count({ where }),
  ]);

  // Transform for charting (reverse to get chronological order)
  const transformed = vitals.reverse().map(v => ({
    time: v.recordedAt.toISOString(),
    pr: v.heartRate,
    spo2: v.spo2,
    rr: v.respRate,
    temp: v.temperature,
    fio2: v.fio2,
    pi: v.pi,
  }));

  logger.info('Vitals history fetched', {
    userId: session.user.id,
    patientId,
    hours,
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
      additionalMeta: {
        patientId,
        hours,
        timeRange: {
          from: since.toISOString(),
          to: new Date().toISOString(),
        },
      },
    })
  );
});

// POST /api/patients/[id]/vitals - Record new vitals (for manual entry or device integration)
export const POST = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const { id } = await params;

  // Validate patient ID
  const idValidation = schemas.idString.safeParse(id);
  if (!idValidation.success) {
    throw new ValidationError([{ field: 'id', message: 'Invalid patient ID' }]);
  }

  const patientId = parseInt(id);

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(createVitalsSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const {
    heartRate,
    spo2,
    respRate,
    temperature,
    fio2,
    pi,
    source = 'manual',
  } = validation.data;

  // Validate patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  const vital = await prisma.vital.create({
    data: {
      patientId,
      heartRate,
      spo2,
      respRate,
      temperature,
      fio2,
      pi,
      source,
    },
  });

  // Check for alarm conditions
  const limits = patient.alarmLimits ? JSON.parse(patient.alarmLimits) : {};
  const alarms = [];

  // SpO2 check
  if (limits.spo2 && spo2 != null) {
    if (spo2 < limits.spo2[0]) {
      alarms.push({
        type: spo2 < limits.spo2[0] - 5 ? 'critical' : 'warning',
        parameter: 'spo2',
        value: spo2,
        threshold: limits.spo2[0],
        message: `SpO2 ${spo2}% below target ${limits.spo2[0]}%`,
      });
    }
  }

  // Heart rate check
  if (limits.pr && heartRate != null) {
    if (heartRate < limits.pr[0]) {
      alarms.push({
        type: 'warning',
        parameter: 'pr',
        value: heartRate,
        threshold: limits.pr[0],
        message: `Heart rate ${heartRate} below ${limits.pr[0]} (bradycardia)`,
      });
    } else if (heartRate > limits.pr[1]) {
      alarms.push({
        type: 'warning',
        parameter: 'pr',
        value: heartRate,
        threshold: limits.pr[1],
        message: `Heart rate ${heartRate} above ${limits.pr[1]} (tachycardia)`,
      });
    }
  }

  // Create any triggered alarms
  for (const alarm of alarms) {
    await prisma.alarm.create({
      data: {
        patientId,
        ...alarm,
      },
    });

    // Update patient status if critical alarm
    if (alarm.type === 'critical' && patient.status !== 'critical') {
      await prisma.patient.update({
        where: { id: patientId },
        data: { status: 'critical' },
      });
    } else if (alarm.type === 'warning' && patient.status === 'normal') {
      await prisma.patient.update({
        where: { id: patientId },
        data: { status: 'warning' },
      });
    }
  }

  logger.info('Vitals recorded', {
    userId: session.user.id,
    patientId,
    vitalId: vital.id,
    source,
    alarmsTriggered: alarms.length,
    duration: `${timer.elapsed()}ms`,
  });

  if (alarms.length > 0) {
    logger.warn('Alarm conditions detected', {
      patientId,
      alarms: alarms.map(a => ({ type: a.type, parameter: a.parameter })),
    });
  }

  return NextResponse.json({
    data: vital,
    alarms: alarms.length > 0 ? alarms : undefined,
  }, { status: 201 });
});
