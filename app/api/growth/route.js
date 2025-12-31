import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';
import { z } from 'zod';

// Query params schema for GET
const growthQuerySchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required').regex(/^\d+$/, 'Patient ID must be numeric'),
  limit: z.string().regex(/^\d+$/).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

// Schema for creating growth measurement
const createGrowthSchema = z.object({
  patientId: z.number().int().positive('Patient ID must be a positive integer'),
  weight: z.number().min(0.1, 'Weight must be at least 0.1 kg').max(15, 'Weight must be 15 kg or less').optional().nullable(),
  length: z.number().min(20, 'Length must be at least 20 cm').max(80, 'Length must be 80 cm or less').optional().nullable(),
  headCirc: z.number().min(15, 'Head circumference must be at least 15 cm').max(50, 'Head circumference must be 50 cm or less').optional().nullable(),
  weightPercentile: z.number().min(0).max(100).optional().nullable(),
  lengthPercentile: z.number().min(0).max(100).optional().nullable(),
  headCircPercentile: z.number().min(0).max(100).optional().nullable(),
  measuredBy: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  measuredAt: z.string().datetime().optional(),
}).refine(
  data => data.weight !== null || data.length !== null || data.headCirc !== null,
  { message: 'At least one measurement (weight, length, or head circumference) is required' }
);

// GET /api/growth - Get growth measurements for a patient
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryResult = growthQuerySchema.safeParse({
    patientId: searchParams.get('patientId'),
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

  const { patientId, limit, startDate, endDate } = queryResult.data;
  const parsedPatientId = parseInt(patientId, 10);
  const parsedLimit = limit ? parseInt(limit, 10) : null;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: parsedPatientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      birthWeight: true,
      gestationalAge: true,
      dateOfBirth: true,
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

  // Fetch growth measurements
  const measurements = await prisma.growthMeasurement.findMany({
    where,
    orderBy: { measuredAt: 'desc' },
    take: parsedLimit ? Math.min(parsedLimit, 100) : 50,
  });

  // Transform to response format
  const transformed = measurements.map(m => ({
    id: m.id,
    patientId: m.patientId,
    weight: m.weight,
    length: m.length,
    headCirc: m.headCirc,
    weightPercentile: m.weightPercentile,
    lengthPercentile: m.lengthPercentile,
    headCircPercentile: m.headCircPercentile,
    measuredBy: m.measuredBy,
    notes: m.notes,
    measuredAt: m.measuredAt.toISOString(),
  }));

  // Calculate growth velocity if we have multiple measurements
  const growthVelocity = calculateGrowthVelocity(measurements);

  logger.info('Growth measurements fetched', {
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
      birthWeight: patient.birthWeight,
      gestationalAge: patient.gestationalAge,
      count: transformed.length,
      growthVelocity,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/growth - Add a new growth measurement
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Only clinical staff can add growth measurements
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse', 'Charge Nurse', 'Staff Nurse', 'Physician', 'Admin']);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validationResult = createGrowthSchema.safeParse(body);
  if (!validationResult.success) {
    const errors = validationResult.error?.errors || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const { patientId, weight, length, headCirc, weightPercentile, lengthPercentile, headCircPercentile, measuredBy, notes, measuredAt } = validationResult.data;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, name: true, mrn: true },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Create the growth measurement
  const measurement = await prisma.growthMeasurement.create({
    data: {
      patientId,
      weight,
      length,
      headCirc,
      weightPercentile,
      lengthPercentile,
      headCircPercentile,
      measuredBy: measuredBy || session.user.name || session.user.email,
      notes,
      measuredAt: measuredAt ? new Date(measuredAt) : new Date(),
    },
  });

  // If weight is provided, also update the patient's current weight
  if (weight !== null && weight !== undefined) {
    await prisma.patient.update({
      where: { id: patientId },
      data: { currentWeight: weight },
    });
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'create_growth_measurement',
      resource: 'growth_measurement',
      resourceId: measurement.id,
      details: JSON.stringify({
        patientId,
        weight,
        length,
        headCirc,
      }),
    },
  });

  logger.audit('Growth measurement recorded', {
    userId: session.user.id,
    patientId,
    measurementId: measurement.id,
    weight,
    length,
    headCirc,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      id: measurement.id,
      patientId: measurement.patientId,
      weight: measurement.weight,
      length: measurement.length,
      headCirc: measurement.headCirc,
      weightPercentile: measurement.weightPercentile,
      lengthPercentile: measurement.lengthPercentile,
      headCircPercentile: measurement.headCircPercentile,
      measuredBy: measurement.measuredBy,
      notes: measurement.notes,
      measuredAt: measurement.measuredAt.toISOString(),
    },
    meta: {
      message: 'Growth measurement recorded successfully',
      patientName: patient.name,
      timestamp: new Date().toISOString(),
    },
  }, { status: 201 });
});

// Helper function to calculate growth velocity
function calculateGrowthVelocity(measurements) {
  if (measurements.length < 2) {
    return null;
  }

  // Sort by date ascending for calculation
  const sorted = [...measurements].sort((a, b) =>
    new Date(a.measuredAt) - new Date(b.measuredAt)
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const daysDiff = (new Date(last.measuredAt) - new Date(first.measuredAt)) / (1000 * 60 * 60 * 24);

  if (daysDiff < 1) {
    return null;
  }

  const velocity = {
    periodDays: Math.round(daysDiff),
  };

  // Weight velocity in g/kg/day
  if (first.weight && last.weight) {
    const weightGain = (last.weight - first.weight) * 1000; // Convert kg to g
    const avgWeight = (first.weight + last.weight) / 2;
    velocity.weightGPerKgPerDay = Math.round((weightGain / avgWeight / daysDiff) * 10) / 10;
    velocity.weightTotalG = Math.round(weightGain);
  }

  // Length velocity in cm/week
  if (first.length && last.length) {
    const lengthGain = last.length - first.length;
    velocity.lengthCmPerWeek = Math.round((lengthGain / daysDiff * 7) * 10) / 10;
  }

  // Head circumference velocity in cm/week
  if (first.headCirc && last.headCirc) {
    const headCircGain = last.headCirc - first.headCirc;
    velocity.headCircCmPerWeek = Math.round((headCircGain / daysDiff * 7) * 10) / 10;
  }

  return velocity;
}
