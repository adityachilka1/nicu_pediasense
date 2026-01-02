import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';
import { z } from 'zod';

// Query params schema
const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
});

// GET /api/flowsheet/[patientId] - Get flowsheet entries for a specific patient
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // In Next.js 15, params is a Promise
  const resolvedParams = await params;
  const patientId = parseInt(resolvedParams.patientId, 10);
  if (isNaN(patientId) || patientId <= 0) {
    throw new ValidationError([{ field: 'patientId', message: 'Patient ID must be a positive integer' }]);
  }

  const { searchParams } = new URL(request.url);

  // Build query object, filtering out null values
  const queryObj = {};
  if (searchParams.get('date')) queryObj.date = searchParams.get('date');
  if (searchParams.get('startDate')) queryObj.startDate = searchParams.get('startDate');
  if (searchParams.get('endDate')) queryObj.endDate = searchParams.get('endDate');

  // Parse and validate query parameters
  const queryResult = querySchema.safeParse(queryObj);

  if (!queryResult.success) {
    const errors = queryResult.error?.errors || queryResult.error?.issues || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const { date, startDate, endDate } = queryResult.data;

  // Verify patient exists and get their weight for calculations
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      currentWeight: true,
      birthWeight: true,
      dayOfLife: true,
      status: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Build where clause for date filtering
  const where = { patientId };

  if (date) {
    // Single date query - get all entries for that date
    const dateStart = new Date(date + 'T00:00:00.000Z');
    const dateEnd = new Date(date + 'T23:59:59.999Z');
    where.shiftDate = {
      gte: dateStart,
      lte: dateEnd,
    };
  } else if (startDate || endDate) {
    // Date range query
    where.shiftDate = {};
    if (startDate) {
      where.shiftDate.gte = new Date(startDate + 'T00:00:00.000Z');
    }
    if (endDate) {
      where.shiftDate.lte = new Date(endDate + 'T23:59:59.999Z');
    }
  } else {
    // Default: today's entries
    const today = new Date();
    const todayStart = new Date(today.toISOString().split('T')[0] + 'T00:00:00.000Z');
    const todayEnd = new Date(today.toISOString().split('T')[0] + 'T23:59:59.999Z');
    where.shiftDate = {
      gte: todayStart,
      lte: todayEnd,
    };
  }

  // Fetch flowsheet entries
  const entries = await prisma.flowsheetEntry.findMany({
    where,
    orderBy: [
      { shiftDate: 'asc' },
      { hour: 'asc' },
    ],
  });

  // Calculate weight in grams for mL/kg calculations
  const weightKg = patient.currentWeight || patient.birthWeight || 1;
  const weightGrams = weightKg * 1000;

  // Transform entries for frontend
  const transformedEntries = entries.map(entry => ({
    id: entry.id,
    patientId: entry.patientId,
    shiftDate: formatDate(entry.shiftDate),
    hour: entry.hour,
    hourFormatted: `${String(entry.hour).padStart(2, '0')}:00`,

    // Intake values
    intake: {
      iv: entry.ivFluids || 0,
      tpn: entry.tpn || 0,
      lipids: entry.lipids || 0,
      bloodProducts: entry.bloodProducts || 0,
      meds: entry.medications || 0,
      feeds: entry.enteral || 0,
      total: (entry.ivFluids || 0) + (entry.tpn || 0) + (entry.lipids || 0) +
             (entry.bloodProducts || 0) + (entry.medications || 0) + (entry.enteral || 0),
    },

    // Output values
    output: {
      urine: entry.urine || 0,
      stool: entry.stool || 0,
      emesis: entry.emesis || 0,
      gastric: entry.gastricOutput || 0,
      ostomy: entry.ostomyOutput || 0,
      drain: entry.drainOutput || 0,
      total: (entry.urine || 0) + (entry.stool || 0) + (entry.emesis || 0) +
             (entry.gastricOutput || 0) + (entry.ostomyOutput || 0) + (entry.drainOutput || 0),
    },

    // Stool characteristics
    stoolCount: entry.stoolCount,
    stoolType: entry.stoolType,

    // Urine characteristics
    urineCount: entry.urineCount,
    specificGravity: entry.specificGravity,

    notes: entry.notes,
    recordedBy: entry.recordedBy,
    recordedAt: entry.recordedAt?.toISOString(),
  }));

  // Calculate running totals for the period
  const totals = calculateTotals(entries, weightKg, entries.length);

  // Calculate last void time (time since last urine output)
  const lastVoidEntry = [...entries].reverse().find(e => e.urine && e.urine > 0);
  let lastVoidHoursAgo = null;
  if (lastVoidEntry) {
    const lastVoidTime = new Date(lastVoidEntry.shiftDate);
    lastVoidTime.setHours(lastVoidEntry.hour);
    const now = new Date();
    lastVoidHoursAgo = Math.round((now.getTime() - lastVoidTime.getTime()) / (1000 * 60 * 60) * 10) / 10;
  }

  logger.info('Flowsheet entries fetched for patient', {
    userId: session.user.id,
    patientId,
    date: date || `${startDate || 'today'} to ${endDate || 'today'}`,
    entriesCount: entries.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformedEntries,
    meta: {
      patientId,
      patientName: patient.name,
      mrn: patient.mrn,
      weightKg,
      dayOfLife: patient.dayOfLife,
      date: date || null,
      dateRange: date ? null : {
        start: startDate || formatDate(new Date()),
        end: endDate || formatDate(new Date()),
      },
      entriesCount: transformedEntries.length,
      totals,
      lastVoidHoursAgo,
      timestamp: new Date().toISOString(),
    },
  });
});

// Helper function to format date as YYYY-MM-DD
function formatDate(date) {
  if (!date) return null;
  return date.toISOString().split('T')[0];
}

// Helper function to calculate totals
function calculateTotals(entries, weightKg, hoursRecorded) {
  const totals = {
    intake: {
      iv: 0,
      tpn: 0,
      lipids: 0,
      bloodProducts: 0,
      meds: 0,
      feeds: 0,
      total: 0,
    },
    output: {
      urine: 0,
      stool: 0,
      emesis: 0,
      gastric: 0,
      ostomy: 0,
      drain: 0,
      total: 0,
    },
    stoolCount: 0,
    urineCount: 0,
    balance: 0,
    hoursRecorded: hoursRecorded || 0,
  };

  for (const entry of entries) {
    // Intake totals
    totals.intake.iv += entry.ivFluids || 0;
    totals.intake.tpn += entry.tpn || 0;
    totals.intake.lipids += entry.lipids || 0;
    totals.intake.bloodProducts += entry.bloodProducts || 0;
    totals.intake.meds += entry.medications || 0;
    totals.intake.feeds += entry.enteral || 0;

    // Output totals
    totals.output.urine += entry.urine || 0;
    totals.output.stool += entry.stool || 0;
    totals.output.emesis += entry.emesis || 0;
    totals.output.gastric += entry.gastricOutput || 0;
    totals.output.ostomy += entry.ostomyOutput || 0;
    totals.output.drain += entry.drainOutput || 0;

    // Counts
    totals.stoolCount += entry.stoolCount || 0;
    totals.urineCount += entry.urineCount || 0;
  }

  // Calculate intake/output totals
  totals.intake.total = totals.intake.iv + totals.intake.tpn + totals.intake.lipids +
                        totals.intake.bloodProducts + totals.intake.meds + totals.intake.feeds;
  totals.output.total = totals.output.urine + totals.output.stool + totals.output.emesis +
                        totals.output.gastric + totals.output.ostomy + totals.output.drain;

  // Net balance
  totals.balance = Math.round((totals.intake.total - totals.output.total) * 10) / 10;

  // Calculate mL/kg values if we have weight
  if (weightKg && weightKg > 0) {
    // mL/kg/day (assuming 24 hours)
    totals.intakeMlPerKgPerDay = Math.round((totals.intake.total / weightKg) * 10) / 10;
    totals.outputMlPerKgPerDay = Math.round((totals.output.total / weightKg) * 10) / 10;

    // Urine output mL/kg/hr (critical metric for neonates)
    if (hoursRecorded > 0) {
      totals.urineOutputMlPerKgPerHr = Math.round((totals.output.urine / weightKg / hoursRecorded) * 100) / 100;
    } else {
      totals.urineOutputMlPerKgPerHr = 0;
    }
  }

  // Round all numeric values
  for (const category of ['intake', 'output']) {
    for (const key of Object.keys(totals[category])) {
      totals[category][key] = Math.round(totals[category][key] * 10) / 10;
    }
  }

  return totals;
}
