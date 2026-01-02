import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';
import { schemas } from '@/lib/validation';
import { z } from 'zod';

// Query params schema
const querySchema = z.object({
  limit: z.string().regex(/^\d+$/).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

// GET /api/growth/[patientId] - Get all growth measurements for a specific patient
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { patientId } = await params;

  // Validate patient ID
  const idValidation = schemas.idString.safeParse(patientId);
  if (!idValidation.success) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  const parsedPatientId = parseInt(patientId, 10);

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const queryResult = querySchema.safeParse({
    limit: searchParams.get('limit'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
  });

  if (!queryResult.success) {
    const errors = queryResult.error?.errors || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const { limit, startDate, endDate } = queryResult.data;
  const parsedLimit = limit ? parseInt(limit, 10) : null;

  // Verify patient exists and get details for context
  const patient = await prisma.patient.findUnique({
    where: { id: parsedPatientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      birthWeight: true,
      gestationalAge: true,
      dateOfBirth: true,
      gender: true,
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
    where.measuredAt = {
      ...where.measuredAt,
      gte: new Date(startDate),
    };
  }

  if (endDate) {
    where.measuredAt = {
      ...where.measuredAt,
      lte: new Date(endDate),
    };
  }

  // Fetch growth measurements ordered by date ascending for chart display
  const measurements = await prisma.growthMeasurement.findMany({
    where,
    orderBy: { measuredAt: 'asc' },
    take: parsedLimit ? Math.min(parsedLimit, 200) : 100,
  });

  // Calculate day of life and PCA (post-conceptional age) for each measurement
  const transformed = measurements.map((m, index) => {
    const measuredDate = new Date(m.measuredAt);
    const birthDate = new Date(patient.dateOfBirth);
    const dayOfLife = Math.floor((measuredDate - birthDate) / (1000 * 60 * 60 * 24));

    // Calculate PCA from gestational age + days of life
    let pca = null;
    if (patient.gestationalAge) {
      const [gaWeeks, gaDays] = patient.gestationalAge.split('+').map(Number);
      const totalDays = gaWeeks * 7 + (gaDays || 0) + dayOfLife;
      const pcaWeeks = Math.floor(totalDays / 7);
      const pcaDays = totalDays % 7;
      pca = `${pcaWeeks}+${pcaDays}`;
    }

    return {
      id: m.id,
      date: m.measuredAt.toISOString().split('T')[0],
      day: dayOfLife,
      weight: m.weight ? Math.round(m.weight * 1000) : null, // Convert kg to grams for display
      length: m.length,
      hc: m.headCirc,
      pca,
      weightPercentile: m.weightPercentile,
      lengthPercentile: m.lengthPercentile,
      hcPercentile: m.headCircPercentile,
      measuredBy: m.measuredBy,
      notes: m.notes,
      measuredAt: m.measuredAt.toISOString(),
    };
  });

  // Calculate growth velocity if we have multiple measurements
  const growthVelocity = calculateGrowthVelocity(measurements);

  // Calculate current percentiles from the most recent measurement
  const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const currentPercentiles = latestMeasurement ? {
    weight: latestMeasurement.weightPercentile || null,
    length: latestMeasurement.lengthPercentile || null,
    hc: latestMeasurement.headCircPercentile || null,
  } : { weight: null, length: null, hc: null };

  logger.info('Growth measurements fetched by patient ID', {
    userId: session.user.id,
    patientId: parsedPatientId,
    count: transformed.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      measurements: transformed,
      percentiles: currentPercentiles,
      velocities: growthVelocity,
    },
    meta: {
      patientId: parsedPatientId,
      patientName: patient.name,
      mrn: patient.mrn,
      birthWeight: patient.birthWeight,
      gestationalAge: patient.gestationalAge,
      gender: patient.gender,
      dayOfLife: patient.dayOfLife,
      count: transformed.length,
      timestamp: new Date().toISOString(),
    },
  });
});

// Helper function to calculate growth velocity
function calculateGrowthVelocity(measurements) {
  if (measurements.length < 2) {
    return { weight: null, length: null, hc: null };
  }

  // Sort by date ascending for calculation
  const sorted = [...measurements].sort((a, b) =>
    new Date(a.measuredAt) - new Date(b.measuredAt)
  );

  // Use last 7 days of data for velocity calculation if available
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const recentMeasurements = sorted.filter(m => new Date(m.measuredAt) >= sevenDaysAgo);
  const measurementsToUse = recentMeasurements.length >= 2 ? recentMeasurements : sorted;

  if (measurementsToUse.length < 2) {
    return { weight: null, length: null, hc: null };
  }

  const first = measurementsToUse[0];
  const last = measurementsToUse[measurementsToUse.length - 1];

  const daysDiff = (new Date(last.measuredAt) - new Date(first.measuredAt)) / (1000 * 60 * 60 * 24);

  if (daysDiff < 1) {
    return { weight: null, length: null, hc: null };
  }

  const velocity = {};

  // Weight velocity in g/kg/day (target: 15-20 g/kg/day for preterm infants)
  if (first.weight && last.weight) {
    const weightGainKg = last.weight - first.weight;
    const weightGainG = weightGainKg * 1000;
    const avgWeightKg = (first.weight + last.weight) / 2;
    velocity.weight = Math.round((weightGainG / avgWeightKg / daysDiff) * 10) / 10;
  } else {
    velocity.weight = null;
  }

  // Length velocity in cm/week (target: ~1 cm/week for preterm infants)
  if (first.length && last.length) {
    const lengthGain = last.length - first.length;
    velocity.length = Math.round((lengthGain / daysDiff * 7) * 10) / 10;
  } else {
    velocity.length = null;
  }

  // Head circumference velocity in cm/week (target: 0.5-1 cm/week for preterm infants)
  if (first.headCirc && last.headCirc) {
    const headCircGain = last.headCirc - first.headCirc;
    velocity.hc = Math.round((headCircGain / daysDiff * 7) * 100) / 100;
  } else {
    velocity.hc = null;
  }

  return velocity;
}
