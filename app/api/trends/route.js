import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';
import { z } from 'zod';

// Query params schema for GET
const trendsQuerySchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required').regex(/^\d+$/, 'Patient ID must be numeric'),
  hours: z.string().regex(/^\d+$/).optional().default('24'),
  parameters: z.string().optional().nullable(), // comma-separated: spo2,heartRate,respRate
});

// GET /api/trends - Get historical vitals trends for a patient
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryResult = trendsQuerySchema.safeParse({
    patientId: searchParams.get('patientId'),
    hours: searchParams.get('hours') || '24',
    parameters: searchParams.get('parameters'),
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

  const { patientId, hours, parameters } = queryResult.data;
  const parsedPatientId = parseInt(patientId, 10);
  const parsedHours = parseInt(hours || '24', 10);

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: parsedPatientId },
    select: { id: true, name: true, mrn: true },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Calculate the time window
  const hoursToFetch = Math.min(Math.max(parsedHours, 1), 168); // Limit between 1 and 168 hours (1 week)
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hoursToFetch);

  // Fetch vitals within the time window
  const vitals = await prisma.vital.findMany({
    where: {
      patientId: parsedPatientId,
      recordedAt: {
        gte: startTime,
      },
    },
    orderBy: { recordedAt: 'asc' },
    select: {
      id: true,
      heartRate: true,
      spo2: true,
      respRate: true,
      temperature: true,
      fio2: true,
      pi: true,
      bpSystolic: true,
      bpDiastolic: true,
      bpMean: true,
      source: true,
      recordedAt: true,
    },
  });

  // Parse parameters to filter if specified
  let filteredVitals = vitals;
  if (parameters) {
    const paramList = parameters.split(',').map(p => p.trim());
    filteredVitals = vitals.map(v => {
      const filtered = {
        id: v.id,
        recordedAt: v.recordedAt,
        source: v.source,
      };
      if (paramList.includes('spo2')) filtered.spo2 = v.spo2;
      if (paramList.includes('heartRate')) filtered.heartRate = v.heartRate;
      if (paramList.includes('respRate')) filtered.respRate = v.respRate;
      if (paramList.includes('temperature')) filtered.temperature = v.temperature;
      if (paramList.includes('fio2')) filtered.fio2 = v.fio2;
      if (paramList.includes('pi')) filtered.pi = v.pi;
      if (paramList.includes('bp')) {
        filtered.bpSystolic = v.bpSystolic;
        filtered.bpDiastolic = v.bpDiastolic;
        filtered.bpMean = v.bpMean;
      }
      return filtered;
    });
  }

  // Transform to trend format with timestamps
  const transformed = filteredVitals.map(v => ({
    ...v,
    recordedAt: v.recordedAt.toISOString(),
    timestamp: v.recordedAt.getTime(),
  }));

  // Calculate statistics for each parameter
  const stats = calculateStats(vitals);

  logger.info('Vitals trends fetched', {
    userId: session.user.id,
    patientId: parsedPatientId,
    hours: hoursToFetch,
    count: transformed.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    meta: {
      patientId: parsedPatientId,
      patientName: patient.name,
      mrn: patient.mrn,
      hours: hoursToFetch,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      count: transformed.length,
      stats,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/trends - Batch fetch trends for multiple patients or parameters
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting (stricter for batch operations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const body = await request.json();

  // Validate request body
  const batchSchema = z.object({
    patientIds: z.array(z.number().int().positive()).min(1).max(10),
    hours: z.number().int().min(1).max(168).default(24),
    parameters: z.array(z.string()).optional(),
  });

  const validationResult = batchSchema.safeParse(body);
  if (!validationResult.success) {
    const errors = validationResult.error?.errors || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const { patientIds, hours, parameters } = validationResult.data;

  // Calculate the time window
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);

  // Fetch vitals for all patients
  const vitals = await prisma.vital.findMany({
    where: {
      patientId: { in: patientIds },
      recordedAt: {
        gte: startTime,
      },
    },
    include: {
      patient: {
        select: { name: true, mrn: true },
      },
    },
    orderBy: [
      { patientId: 'asc' },
      { recordedAt: 'asc' },
    ],
  });

  // Group by patient
  const groupedByPatient = {};
  for (const vital of vitals) {
    const pid = vital.patientId;
    if (!groupedByPatient[pid]) {
      groupedByPatient[pid] = {
        patientId: pid,
        patientName: vital.patient.name,
        mrn: vital.patient.mrn,
        vitals: [],
      };
    }

    const vitalData = {
      id: vital.id,
      heartRate: vital.heartRate,
      spo2: vital.spo2,
      respRate: vital.respRate,
      temperature: vital.temperature,
      fio2: vital.fio2,
      pi: vital.pi,
      bpSystolic: vital.bpSystolic,
      bpDiastolic: vital.bpDiastolic,
      bpMean: vital.bpMean,
      source: vital.source,
      recordedAt: vital.recordedAt.toISOString(),
      timestamp: vital.recordedAt.getTime(),
    };

    // Filter parameters if specified
    if (parameters && parameters.length > 0) {
      const filtered = {
        id: vitalData.id,
        recordedAt: vitalData.recordedAt,
        timestamp: vitalData.timestamp,
        source: vitalData.source,
      };
      for (const param of parameters) {
        if (vitalData[param] !== undefined) {
          filtered[param] = vitalData[param];
        }
      }
      groupedByPatient[pid].vitals.push(filtered);
    } else {
      groupedByPatient[pid].vitals.push(vitalData);
    }
  }

  // Calculate stats for each patient
  for (const pid of Object.keys(groupedByPatient)) {
    groupedByPatient[pid].stats = calculateStats(groupedByPatient[pid].vitals);
  }

  const result = Object.values(groupedByPatient);

  logger.info('Batch vitals trends fetched', {
    userId: session.user.id,
    patientIds,
    hours,
    totalVitals: vitals.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: result,
    meta: {
      patientCount: result.length,
      hours,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      totalRecords: vitals.length,
      timestamp: new Date().toISOString(),
    },
  });
});

// Helper function to calculate statistics
function calculateStats(vitals) {
  const stats = {
    heartRate: { min: null, max: null, avg: null, count: 0 },
    spo2: { min: null, max: null, avg: null, count: 0 },
    respRate: { min: null, max: null, avg: null, count: 0 },
    temperature: { min: null, max: null, avg: null, count: 0 },
  };

  const sums = {
    heartRate: 0,
    spo2: 0,
    respRate: 0,
    temperature: 0,
  };

  for (const vital of vitals) {
    // Heart Rate
    if (vital.heartRate !== null && vital.heartRate !== undefined) {
      stats.heartRate.count++;
      sums.heartRate += vital.heartRate;
      if (stats.heartRate.min === null || vital.heartRate < stats.heartRate.min) {
        stats.heartRate.min = vital.heartRate;
      }
      if (stats.heartRate.max === null || vital.heartRate > stats.heartRate.max) {
        stats.heartRate.max = vital.heartRate;
      }
    }

    // SpO2
    if (vital.spo2 !== null && vital.spo2 !== undefined) {
      stats.spo2.count++;
      sums.spo2 += vital.spo2;
      if (stats.spo2.min === null || vital.spo2 < stats.spo2.min) {
        stats.spo2.min = vital.spo2;
      }
      if (stats.spo2.max === null || vital.spo2 > stats.spo2.max) {
        stats.spo2.max = vital.spo2;
      }
    }

    // Resp Rate
    if (vital.respRate !== null && vital.respRate !== undefined) {
      stats.respRate.count++;
      sums.respRate += vital.respRate;
      if (stats.respRate.min === null || vital.respRate < stats.respRate.min) {
        stats.respRate.min = vital.respRate;
      }
      if (stats.respRate.max === null || vital.respRate > stats.respRate.max) {
        stats.respRate.max = vital.respRate;
      }
    }

    // Temperature
    if (vital.temperature !== null && vital.temperature !== undefined) {
      stats.temperature.count++;
      sums.temperature += vital.temperature;
      if (stats.temperature.min === null || vital.temperature < stats.temperature.min) {
        stats.temperature.min = vital.temperature;
      }
      if (stats.temperature.max === null || vital.temperature > stats.temperature.max) {
        stats.temperature.max = vital.temperature;
      }
    }
  }

  // Calculate averages
  if (stats.heartRate.count > 0) {
    stats.heartRate.avg = Math.round(sums.heartRate / stats.heartRate.count);
  }
  if (stats.spo2.count > 0) {
    stats.spo2.avg = Math.round(sums.spo2 / stats.spo2.count);
  }
  if (stats.respRate.count > 0) {
    stats.respRate.avg = Math.round(sums.respRate / stats.respRate.count);
  }
  if (stats.temperature.count > 0) {
    stats.temperature.avg = Math.round((sums.temperature / stats.temperature.count) * 10) / 10;
  }

  return stats;
}
