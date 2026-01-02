import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';
import { z } from 'zod';

// Query params schema for GET
const feedingQuerySchema = z.object({
  patientId: z.string().regex(/^\d+$/, 'Patient ID must be numeric'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  feedingType: z.enum(['breast', 'formula', 'fortified', 'tpn', 'enteral']).optional(),
});

// Schema for creating feeding log
const createFeedingSchema = z.object({
  patientId: z.number().int().positive('Patient ID must be a positive integer'),
  feedingType: z.enum(['breast', 'formula', 'fortified', 'tpn', 'enteral'], {
    errorMap: () => ({ message: 'Feeding type must be breast, formula, fortified, tpn, or enteral' }),
  }),
  route: z.enum(['oral', 'ng', 'og', 'gt'], {
    errorMap: () => ({ message: 'Route must be oral, ng (nasogastric), og (orogastric), or gt (gastrostomy)' }),
  }),
  volumeOrdered: z.number().min(0).max(500).optional().nullable(),
  volumeGiven: z.number().min(0).max(500).optional().nullable(),
  volumeResidual: z.number().min(0).max(200).optional().nullable(),
  residualColor: z.enum(['clear', 'bilious', 'bloody', 'milky', 'yellow', 'green']).optional().nullable(),
  tolerance: z.enum(['good', 'fair', 'poor']).optional().nullable(),
  emesis: z.boolean().default(false),
  emesisAmount: z.number().min(0).max(200).optional().nullable(),
  fortified: z.boolean().default(false),
  calories: z.number().int().min(0).max(50).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  recordedBy: z.string().max(100).optional().nullable(),
  recordedAt: z.string().datetime().optional(),
});

// GET /api/feeding - Get feeding logs for a patient
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);

  // Build query object, filtering out null values (searchParams.get returns null for missing params)
  const queryObj = {
    patientId: searchParams.get('patientId'),
  };
  if (searchParams.get('limit')) queryObj.limit = searchParams.get('limit');
  if (searchParams.get('startDate')) queryObj.startDate = searchParams.get('startDate');
  if (searchParams.get('endDate')) queryObj.endDate = searchParams.get('endDate');
  if (searchParams.get('feedingType')) queryObj.feedingType = searchParams.get('feedingType');

  // Parse and validate query parameters
  const queryResult = feedingQuerySchema.safeParse(queryObj);

  if (!queryResult.success) {
    const errors = queryResult.error?.errors || queryResult.error?.issues || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const { patientId, limit, startDate, endDate, feedingType } = queryResult.data;
  const parsedPatientId = parseInt(patientId, 10);

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: parsedPatientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      currentWeight: true,
      dayOfLife: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Build where clause
  const where = {
    patientId: parsedPatientId,
  };

  if (startDate) {
    where.recordedAt = {
      ...where.recordedAt,
      gte: new Date(startDate),
    };
  }

  if (endDate) {
    where.recordedAt = {
      ...where.recordedAt,
      lte: new Date(endDate),
    };
  }

  if (feedingType) {
    // Map lowercase input to uppercase Prisma enum values
    const feedingTypeMap = {
      breast: 'BREAST_MILK',
      formula: 'FORMULA',
      fortified: 'FORTIFIED_BREAST_MILK',
      tpn: 'TPN',
      enteral: 'MIXED',
    };
    where.feedingType = feedingTypeMap[feedingType] || feedingType.toUpperCase();
  }

  // Fetch feeding logs
  const feedingLogs = await prisma.feedingLog.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
    take: limit ? Math.min(limit, 100) : 50,
  });

  // Transform to response format
  const transformed = feedingLogs.map(f => ({
    id: f.id,
    patientId: f.patientId,
    feedingType: f.feedingType,
    route: f.route,
    volumeOrdered: f.volumeOrdered,
    volumeGiven: f.volumeGiven,
    volumeResidual: f.volumeResidual,
    residualColor: f.residualColor,
    tolerance: f.tolerance,
    emesis: f.emesis,
    emesisAmount: f.emesisAmount,
    fortified: f.fortified,
    calories: f.calories,
    notes: f.notes,
    recordedBy: f.recordedBy,
    recordedAt: f.recordedAt.toISOString(),
  }));

  // Calculate feeding summary for the last 24 hours
  const last24Hours = new Date();
  last24Hours.setHours(last24Hours.getHours() - 24);

  const recent = feedingLogs.filter(f => new Date(f.recordedAt) >= last24Hours);
  const summary = calculateFeedingSummary(recent, patient.currentWeight);

  logger.info('Feeding logs fetched', {
    userId: session.user.id,
    patientId: parsedPatientId,
    count: transformed.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    meta: {
      patientId: parsedPatientId,
      patientName: patient.name,
      mrn: patient.mrn,
      count: transformed.length,
      summary24h: summary,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/feeding - Add a new feeding log
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Only clinical staff can add feeding logs
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse', 'Charge Nurse', 'Staff Nurse', 'Physician', 'Admin']);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validationResult = createFeedingSchema.safeParse(body);
  if (!validationResult.success) {
    const errors = validationResult.error?.errors || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const {
    patientId,
    feedingType: inputFeedingType,
    route: inputRoute,
    volumeOrdered,
    volumeGiven,
    volumeResidual,
    residualColor: inputResidualColor,
    tolerance: inputTolerance,
    emesis,
    emesisAmount,
    fortified,
    calories,
    notes,
    recordedBy,
    recordedAt,
  } = validationResult.data;

  // Map lowercase values to uppercase Prisma enum values
  const feedingTypeMap = {
    breast: 'BREAST_MILK',
    formula: 'FORMULA',
    fortified: 'FORTIFIED_BREAST_MILK',
    tpn: 'TPN',
    enteral: 'MIXED',
  };
  const feedingType = feedingTypeMap[inputFeedingType] || inputFeedingType.toUpperCase();

  const routeMap = {
    oral: 'ORAL',
    ng: 'NG_TUBE',
    og: 'OG_TUBE',
    gt: 'GT_TUBE',
    nj: 'NJ_TUBE',
    iv: 'IV',
  };
  const route = routeMap[inputRoute] || inputRoute.toUpperCase();

  // residualColor is stored as a String, not an enum - pass through as-is
  const residualColor = inputResidualColor || null;

  const toleranceMap = {
    excellent: 'EXCELLENT',
    good: 'GOOD',
    fair: 'FAIR',
    poor: 'POOR',
    intolerant: 'INTOLERANT',
  };
  const tolerance = inputTolerance ? (toleranceMap[inputTolerance] || inputTolerance.toUpperCase()) : null;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, name: true, mrn: true },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Create the feeding log
  const feedingLog = await prisma.feedingLog.create({
    data: {
      patientId,
      feedingType,
      route,
      volumeOrdered,
      volumeGiven,
      volumeResidual,
      residualColor,
      tolerance,
      emesis,
      emesisAmount: emesis ? emesisAmount : null,
      fortified,
      calories: fortified ? calories : null,
      notes,
      recordedBy: recordedBy || session.user.name || session.user.email,
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'create_feeding_log',
      resource: 'feeding_log',
      resourceId: feedingLog.id,
      details: JSON.stringify({
        patientId,
        feedingType,
        route,
        volumeGiven,
      }),
    },
  });

  logger.audit('Feeding log recorded', {
    userId: session.user.id,
    patientId,
    feedingLogId: feedingLog.id,
    feedingType,
    route,
    volumeGiven,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      id: feedingLog.id,
      patientId: feedingLog.patientId,
      feedingType: feedingLog.feedingType,
      route: feedingLog.route,
      volumeOrdered: feedingLog.volumeOrdered,
      volumeGiven: feedingLog.volumeGiven,
      volumeResidual: feedingLog.volumeResidual,
      residualColor: feedingLog.residualColor,
      tolerance: feedingLog.tolerance,
      emesis: feedingLog.emesis,
      emesisAmount: feedingLog.emesisAmount,
      fortified: feedingLog.fortified,
      calories: feedingLog.calories,
      notes: feedingLog.notes,
      recordedBy: feedingLog.recordedBy,
      recordedAt: feedingLog.recordedAt.toISOString(),
    },
    meta: {
      message: 'Feeding log recorded successfully',
      patientName: patient.name,
      timestamp: new Date().toISOString(),
    },
  }, { status: 201 });
});

// Helper function to calculate feeding summary
function calculateFeedingSummary(feedingLogs, currentWeightKg) {
  const summary = {
    totalFeedings: feedingLogs.length,
    totalVolumeGiven: 0,
    totalResidual: 0,
    totalEmesis: 0,
    byType: {},
    byRoute: {},
    toleranceBreakdown: { good: 0, fair: 0, poor: 0 },
  };

  for (const log of feedingLogs) {
    // Total volumes
    if (log.volumeGiven) {
      summary.totalVolumeGiven += log.volumeGiven;
    }
    if (log.volumeResidual) {
      summary.totalResidual += log.volumeResidual;
    }
    if (log.emesis && log.emesisAmount) {
      summary.totalEmesis += log.emesisAmount;
    }

    // By type
    if (!summary.byType[log.feedingType]) {
      summary.byType[log.feedingType] = { count: 0, volume: 0 };
    }
    summary.byType[log.feedingType].count++;
    if (log.volumeGiven) {
      summary.byType[log.feedingType].volume += log.volumeGiven;
    }

    // By route
    if (!summary.byRoute[log.route]) {
      summary.byRoute[log.route] = { count: 0, volume: 0 };
    }
    summary.byRoute[log.route].count++;
    if (log.volumeGiven) {
      summary.byRoute[log.route].volume += log.volumeGiven;
    }

    // Tolerance breakdown
    if (log.tolerance && summary.toleranceBreakdown[log.tolerance] !== undefined) {
      summary.toleranceBreakdown[log.tolerance]++;
    }
  }

  // Round volumes
  summary.totalVolumeGiven = Math.round(summary.totalVolumeGiven * 10) / 10;
  summary.totalResidual = Math.round(summary.totalResidual * 10) / 10;
  summary.totalEmesis = Math.round(summary.totalEmesis * 10) / 10;

  // Calculate mL/kg/day if we have weight
  if (currentWeightKg && currentWeightKg > 0) {
    summary.mlPerKgPerDay = Math.round((summary.totalVolumeGiven / currentWeightKg) * 10) / 10;
  }

  // Net volume
  summary.netVolume = Math.round((summary.totalVolumeGiven - summary.totalResidual - summary.totalEmesis) * 10) / 10;

  return summary;
}
