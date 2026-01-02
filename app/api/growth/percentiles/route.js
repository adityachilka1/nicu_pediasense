import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';
import { FENTON_PERCENTILES } from '@/lib/data';
import { z } from 'zod';

// Query params schema for percentile calculation
const percentileQuerySchema = z.object({
  gender: z.enum(['M', 'F', 'male', 'female']).transform(val => {
    // Normalize to 'male' or 'female' for FENTON_PERCENTILES lookup
    if (val === 'M') return 'male';
    if (val === 'F') return 'female';
    return val;
  }),
  gaWeeks: z.string().regex(/^\d+$/, 'GA weeks must be numeric'),
  gaDays: z.string().regex(/^\d+$/, 'GA days must be numeric').optional().default('0'),
  weight: z.string().regex(/^\d+(\.\d+)?$/, 'Weight must be numeric').optional().nullable(),
  length: z.string().regex(/^\d+(\.\d+)?$/, 'Length must be numeric').optional().nullable(),
  headCirc: z.string().regex(/^\d+(\.\d+)?$/, 'Head circumference must be numeric').optional().nullable(),
});

// POST body schema for batch percentile calculation
const batchPercentileSchema = z.object({
  gender: z.enum(['M', 'F', 'male', 'female']).transform(val => {
    if (val === 'M') return 'male';
    if (val === 'F') return 'female';
    return val;
  }),
  measurements: z.array(z.object({
    gaWeeks: z.number().int().min(22).max(50),
    gaDays: z.number().int().min(0).max(6).optional().default(0),
    weight: z.number().positive().optional().nullable(),
    length: z.number().positive().optional().nullable(),
    headCirc: z.number().positive().optional().nullable(),
  })).min(1).max(100),
});

// GET /api/growth/percentiles - Calculate Fenton percentiles for given measurements
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryResult = percentileQuerySchema.safeParse({
    gender: searchParams.get('gender'),
    gaWeeks: searchParams.get('gaWeeks'),
    gaDays: searchParams.get('gaDays'),
    weight: searchParams.get('weight'),
    length: searchParams.get('length'),
    headCirc: searchParams.get('headCirc'),
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

  const { gender, gaWeeks, gaDays, weight, length, headCirc } = queryResult.data;
  const parsedGaWeeks = parseInt(gaWeeks, 10);
  const parsedGaDays = parseInt(gaDays || '0', 10);
  const parsedWeight = weight ? parseFloat(weight) : null;
  const parsedLength = length ? parseFloat(length) : null;
  const parsedHeadCirc = headCirc ? parseFloat(headCirc) : null;

  // Calculate exact gestational age in weeks
  const exactGA = parsedGaWeeks + parsedGaDays / 7;

  // Calculate percentiles
  const percentiles = calculateFentonPercentiles(gender, exactGA, {
    weight: parsedWeight,
    length: parsedLength,
    headCirc: parsedHeadCirc,
  });

  logger.info('Percentiles calculated', {
    userId: session.user.id,
    gender,
    gaWeeks: parsedGaWeeks,
    gaDays: parsedGaDays,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      gender,
      gestationalAge: {
        weeks: parsedGaWeeks,
        days: parsedGaDays,
        exact: Math.round(exactGA * 100) / 100,
        display: `${parsedGaWeeks}+${parsedGaDays}`,
      },
      measurements: {
        weight: parsedWeight,
        length: parsedLength,
        headCirc: parsedHeadCirc,
      },
      percentiles,
    },
    meta: {
      source: 'Fenton 2013 Growth Charts',
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/growth/percentiles - Calculate percentiles for batch measurements
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting (stricter for batch operations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const rawBody = await request.json();

  const validationResult = batchPercentileSchema.safeParse(rawBody);
  if (!validationResult.success) {
    const errors = validationResult.error?.errors || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const { gender, measurements } = validationResult.data;

  // Calculate percentiles for each measurement
  const results = measurements.map((m, index) => {
    const exactGA = m.gaWeeks + (m.gaDays || 0) / 7;
    const percentiles = calculateFentonPercentiles(gender, exactGA, {
      weight: m.weight,
      length: m.length,
      headCirc: m.headCirc,
    });

    return {
      index,
      gestationalAge: {
        weeks: m.gaWeeks,
        days: m.gaDays || 0,
        exact: Math.round(exactGA * 100) / 100,
        display: `${m.gaWeeks}+${m.gaDays || 0}`,
      },
      measurements: {
        weight: m.weight,
        length: m.length,
        headCirc: m.headCirc,
      },
      percentiles,
    };
  });

  logger.info('Batch percentiles calculated', {
    userId: session.user.id,
    gender,
    measurementCount: measurements.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      gender,
      results,
    },
    meta: {
      source: 'Fenton 2013 Growth Charts',
      count: results.length,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Calculate Fenton percentiles for given measurements at a specific gestational age
 * Uses linear interpolation between available data points
 */
function calculateFentonPercentiles(gender, exactGA, measurements) {
  const result = {
    weight: null,
    length: null,
    headCirc: null,
  };

  const genderData = FENTON_PERCENTILES[gender];
  if (!genderData) {
    return result;
  }

  // Calculate weight percentile
  if (measurements.weight !== null && measurements.weight !== undefined) {
    result.weight = calculatePercentileForMeasurement(
      genderData.weight,
      exactGA,
      measurements.weight
    );
  }

  // Calculate length percentile
  if (measurements.length !== null && measurements.length !== undefined) {
    result.length = calculatePercentileForMeasurement(
      genderData.length,
      exactGA,
      measurements.length
    );
  }

  // Calculate head circumference percentile
  if (measurements.headCirc !== null && measurements.headCirc !== undefined) {
    result.headCirc = calculatePercentileForMeasurement(
      genderData.headCircumference,
      exactGA,
      measurements.headCirc
    );
  }

  return result;
}

/**
 * Calculate percentile for a single measurement using linear interpolation
 */
function calculatePercentileForMeasurement(data, exactGA, value) {
  if (!data || value === null || value === undefined) {
    return null;
  }

  // Get available weeks
  const availableWeeks = Object.keys(data).map(Number).sort((a, b) => a - b);

  if (availableWeeks.length === 0) {
    return null;
  }

  // Find bounding weeks for interpolation
  const floorGA = Math.floor(exactGA);
  const ceilGA = Math.ceil(exactGA);

  // Handle edge cases
  if (floorGA < availableWeeks[0]) {
    return calculatePercentileAtWeek(data[availableWeeks[0]], value);
  }
  if (ceilGA > availableWeeks[availableWeeks.length - 1]) {
    return calculatePercentileAtWeek(data[availableWeeks[availableWeeks.length - 1]], value);
  }

  // Find the closest available weeks
  const lowerWeek = availableWeeks.filter(w => w <= floorGA).pop() || availableWeeks[0];
  const upperWeek = availableWeeks.filter(w => w >= ceilGA)[0] || availableWeeks[availableWeeks.length - 1];

  if (lowerWeek === upperWeek) {
    return calculatePercentileAtWeek(data[lowerWeek], value);
  }

  // Interpolate between two weeks
  const lowerPercentile = calculatePercentileAtWeek(data[lowerWeek], value);
  const upperPercentile = calculatePercentileAtWeek(data[upperWeek], value);

  if (lowerPercentile === null || upperPercentile === null) {
    return lowerPercentile || upperPercentile;
  }

  const fraction = (exactGA - lowerWeek) / (upperWeek - lowerWeek);
  return Math.round((lowerPercentile + fraction * (upperPercentile - lowerPercentile)) * 10) / 10;
}

/**
 * Calculate percentile at a specific week using the available percentile cutoffs
 * Uses linear interpolation between percentile curves
 */
function calculatePercentileAtWeek(weekData, value) {
  if (!weekData) {
    return null;
  }

  const percentileCutoffs = [
    { percentile: 3, value: weekData.p3 },
    { percentile: 10, value: weekData.p10 },
    { percentile: 50, value: weekData.p50 },
    { percentile: 90, value: weekData.p90 },
    { percentile: 97, value: weekData.p97 },
  ].filter(p => p.value !== undefined);

  if (percentileCutoffs.length === 0) {
    return null;
  }

  // Check if below lowest percentile
  if (value <= percentileCutoffs[0].value) {
    // Extrapolate below 3rd percentile
    if (percentileCutoffs.length >= 2) {
      const p1 = percentileCutoffs[0];
      const p2 = percentileCutoffs[1];
      const slope = (p2.percentile - p1.percentile) / (p2.value - p1.value);
      const extrapolated = p1.percentile + slope * (value - p1.value);
      return Math.max(0, Math.round(extrapolated * 10) / 10);
    }
    return 0;
  }

  // Check if above highest percentile
  if (value >= percentileCutoffs[percentileCutoffs.length - 1].value) {
    // Extrapolate above 97th percentile
    const lastIdx = percentileCutoffs.length - 1;
    if (lastIdx >= 1) {
      const p1 = percentileCutoffs[lastIdx - 1];
      const p2 = percentileCutoffs[lastIdx];
      const slope = (p2.percentile - p1.percentile) / (p2.value - p1.value);
      const extrapolated = p2.percentile + slope * (value - p2.value);
      return Math.min(100, Math.round(extrapolated * 10) / 10);
    }
    return 100;
  }

  // Find bounding percentiles and interpolate
  for (let i = 0; i < percentileCutoffs.length - 1; i++) {
    const lower = percentileCutoffs[i];
    const upper = percentileCutoffs[i + 1];

    if (value >= lower.value && value <= upper.value) {
      const fraction = (value - lower.value) / (upper.value - lower.value);
      return Math.round((lower.percentile + fraction * (upper.percentile - lower.percentile)) * 10) / 10;
    }
  }

  return 50; // Default to median if something goes wrong
}
