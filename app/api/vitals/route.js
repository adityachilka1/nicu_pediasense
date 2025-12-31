import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, AuthorizationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';

// GET /api/vitals - Get latest vitals for all admitted patients
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // Get all admitted patients with their latest vital
  const patients = await prisma.patient.findMany({
    where: {
      dischargeDate: null,
    },
    include: {
      bed: true,
      vitals: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
    },
  });

  // Create a map of patient ID to latest vitals
  const vitalsMap = {};
  for (const patient of patients) {
    const latest = patient.vitals[0];
    if (latest) {
      vitalsMap[patient.id] = {
        pr: latest.heartRate || '--',
        spo2: latest.spo2 || '--',
        rr: latest.respRate || '--',
        temp: latest.temperature?.toFixed(1) || '--',
        fio2: latest.fio2 || '--',
        pi: latest.pi?.toFixed(1) || '--',
        recordedAt: latest.recordedAt.toISOString(),
      };
    } else {
      vitalsMap[patient.id] = {
        pr: '--',
        spo2: '--',
        rr: '--',
        temp: '--',
        fio2: '--',
        pi: '--',
      };
    }
  }

  logger.info('Latest vitals fetched', {
    userId: session.user.id,
    patientCount: patients.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: vitalsMap,
    meta: {
      patientCount: patients.length,
      timestamp: new Date().toISOString(),
    }
  });
});

// POST /api/vitals/simulate - Generate simulated vitals for all patients (dev only)
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();

  // Block in production
  if (process.env.NODE_ENV === 'production') {
    throw new AuthorizationError('Simulation not available in production');
  }

  const session = await auth();
  requireAuth(session);

  // Rate limiting (heavy since we're creating multiple records)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Get all admitted patients
  const patients = await prisma.patient.findMany({
    where: { dischargeDate: null },
  });

  const results = [];

  for (const patient of patients) {
    // Base values based on status
    const bases = {
      normal: { hr: 140, spo2: 96, rr: 42, temp: 36.7, fio2: 21 },
      warning: { hr: 160, spo2: 90, rr: 55, temp: 37.1, fio2: 35 },
      critical: { hr: 180, spo2: 84, rr: 70, temp: 38.0, fio2: 55 },
    };

    const base = bases[patient.status] || bases.normal;
    const variance = patient.status === 'critical' ? 5 : patient.status === 'warning' ? 3 : 1;

    const vital = await prisma.vital.create({
      data: {
        patientId: patient.id,
        heartRate: Math.round(base.hr + (Math.random() - 0.5) * variance * 4),
        spo2: Math.min(100, Math.max(70, Math.round(base.spo2 + (Math.random() - 0.5) * variance * 2))),
        respRate: Math.round(base.rr + (Math.random() - 0.5) * variance * 4),
        temperature: parseFloat((base.temp + (Math.random() - 0.5) * 0.3).toFixed(1)),
        fio2: base.fio2,
        pi: parseFloat((0.5 + Math.random() * 4).toFixed(1)),
        source: 'simulator',
      },
    });

    results.push({ patientId: patient.id, vitalId: vital.id });
  }

  logger.info('Vitals simulation completed', {
    userId: session.user.id,
    patientCount: results.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    message: `Generated vitals for ${results.length} patients`,
    data: results,
  });
});
