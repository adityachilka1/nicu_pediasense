import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';

// GET /api/flowsheet/[patientId]/totals - Get 24-hour running totals
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // Validate patient ID
  const patientId = parseInt(params.patientId, 10);
  if (isNaN(patientId) || patientId <= 0) {
    throw new ValidationError([{ field: 'patientId', message: 'Patient ID must be a positive integer' }]);
  }

  // Verify patient exists and get their weight
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      currentWeight: true,
      birthWeight: true,
      dayOfLife: true,
      gestationalAge: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Get entries from the last 24 hours
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const entries = await prisma.flowsheetEntry.findMany({
    where: {
      patientId,
      recordedAt: {
        gte: twentyFourHoursAgo,
      },
    },
    orderBy: [
      { shiftDate: 'desc' },
      { hour: 'desc' },
    ],
  });

  // Use current weight, fallback to birth weight
  const weightKg = patient.currentWeight || patient.birthWeight || 1;
  const hoursRecorded = entries.length;

  // Calculate comprehensive totals
  const totals = {
    // Intake breakdown
    intake: {
      ivFluids: 0,
      tpn: 0,
      lipids: 0,
      bloodProducts: 0,
      medications: 0,
      enteral: 0,
      total: 0,
    },
    // Output breakdown
    output: {
      urine: 0,
      stool: 0,
      emesis: 0,
      gastricOutput: 0,
      ostomyOutput: 0,
      drainOutput: 0,
      total: 0,
    },
    // Counts
    stoolCount: 0,
    urineCount: 0,
    // Net balance
    netBalance: 0,
    // Per-kg calculations
    rates: {},
    // Metadata
    hoursRecorded,
    periodStart: twentyFourHoursAgo.toISOString(),
    periodEnd: new Date().toISOString(),
  };

  // Sum up all entries
  for (const entry of entries) {
    // Intake
    totals.intake.ivFluids += entry.ivFluids || 0;
    totals.intake.tpn += entry.tpn || 0;
    totals.intake.lipids += entry.lipids || 0;
    totals.intake.bloodProducts += entry.bloodProducts || 0;
    totals.intake.medications += entry.medications || 0;
    totals.intake.enteral += entry.enteral || 0;

    // Output
    totals.output.urine += entry.urine || 0;
    totals.output.stool += entry.stool || 0;
    totals.output.emesis += entry.emesis || 0;
    totals.output.gastricOutput += entry.gastricOutput || 0;
    totals.output.ostomyOutput += entry.ostomyOutput || 0;
    totals.output.drainOutput += entry.drainOutput || 0;

    // Counts
    totals.stoolCount += entry.stoolCount || 0;
    totals.urineCount += entry.urineCount || 0;
  }

  // Calculate totals
  totals.intake.total = Object.entries(totals.intake)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, val]) => sum + val, 0);

  totals.output.total = Object.entries(totals.output)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, val]) => sum + val, 0);

  totals.netBalance = totals.intake.total - totals.output.total;

  // Round all values to 1 decimal place
  for (const category of ['intake', 'output']) {
    for (const key of Object.keys(totals[category])) {
      totals[category][key] = Math.round(totals[category][key] * 10) / 10;
    }
  }
  totals.netBalance = Math.round(totals.netBalance * 10) / 10;

  // Calculate rates per kg
  if (weightKg > 0) {
    totals.rates = {
      // mL/kg/day (total intake/output per kg over 24 hours)
      intakeMlPerKgPerDay: Math.round((totals.intake.total / weightKg) * 10) / 10,
      outputMlPerKgPerDay: Math.round((totals.output.total / weightKg) * 10) / 10,

      // Urine output mL/kg/hr - critical for assessing renal function
      // Normal: 1-3 mL/kg/hr for neonates
      urineOutputMlPerKgPerHr: hoursRecorded > 0
        ? Math.round((totals.output.urine / weightKg / hoursRecorded) * 100) / 100
        : 0,

      // Enteral feeding mL/kg/day
      enteralMlPerKgPerDay: Math.round((totals.intake.enteral / weightKg) * 10) / 10,

      // IV fluid mL/kg/day
      ivFluidsMlPerKgPerDay: Math.round((totals.intake.ivFluids / weightKg) * 10) / 10,
    };

    // Assess urine output status for clinical alerts
    const urineRate = totals.rates.urineOutputMlPerKgPerHr;
    if (urineRate < 0.5) {
      totals.urineOutputStatus = 'critical'; // Oliguria/Anuria
      totals.urineOutputAlert = 'Critically low urine output - evaluate renal function';
    } else if (urineRate < 1.0) {
      totals.urineOutputStatus = 'low';
      totals.urineOutputAlert = 'Low urine output - monitor closely';
    } else if (urineRate <= 3.0) {
      totals.urineOutputStatus = 'normal';
      totals.urineOutputAlert = null;
    } else {
      totals.urineOutputStatus = 'high';
      totals.urineOutputAlert = 'Elevated urine output - assess fluid status';
    }
  }

  // Get last void time
  const lastUrineEntry = entries.find(e => e.urine && e.urine > 0);
  if (lastUrineEntry) {
    const lastVoidTime = new Date(lastUrineEntry.shiftDate);
    lastVoidTime.setHours(lastUrineEntry.hour);
    const hoursSinceVoid = (Date.now() - lastVoidTime.getTime()) / (1000 * 60 * 60);
    totals.lastVoidHoursAgo = Math.round(hoursSinceVoid * 10) / 10;

    // Alert if no void in >6 hours
    if (hoursSinceVoid > 6) {
      totals.voidAlert = 'No urine output recorded in >6 hours';
    }
  } else {
    totals.lastVoidHoursAgo = null;
    if (hoursRecorded > 0) {
      totals.voidAlert = 'No urine output recorded in monitoring period';
    }
  }

  // Get last stool time
  const lastStoolEntry = entries.find(e => e.stool && e.stool > 0);
  if (lastStoolEntry) {
    const lastStoolTime = new Date(lastStoolEntry.shiftDate);
    lastStoolTime.setHours(lastStoolEntry.hour);
    const hoursSinceStool = (Date.now() - lastStoolTime.getTime()) / (1000 * 60 * 60);
    totals.lastStoolHoursAgo = Math.round(hoursSinceStool * 10) / 10;
  } else {
    totals.lastStoolHoursAgo = null;
  }

  logger.info('Flowsheet 24h totals calculated', {
    userId: session.user.id,
    patientId,
    hoursRecorded,
    urineOutputMlPerKgPerHr: totals.rates?.urineOutputMlPerKgPerHr,
    netBalance: totals.netBalance,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: totals,
    meta: {
      patientId,
      patientName: patient.name,
      mrn: patient.mrn,
      weightKg,
      gestationalAge: patient.gestationalAge,
      dayOfLife: patient.dayOfLife,
      calculatedAt: new Date().toISOString(),
    },
  });
});
