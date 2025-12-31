import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';
import { z } from 'zod';

// Query params schema for GET
const flowsheetQuerySchema = z.object({
  patientId: z.string().regex(/^\d+$/, 'Patient ID must be numeric'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Schema for creating flowsheet entry
const createFlowsheetSchema = z.object({
  patientId: z.number().int().positive('Patient ID must be a positive integer'),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Shift date must be in YYYY-MM-DD format'),
  hour: z.number().int().min(0).max(23, 'Hour must be between 0 and 23'),

  // Intake (mL)
  ivFluids: z.number().min(0).max(500).optional().nullable(),
  tpn: z.number().min(0).max(500).optional().nullable(),
  lipids: z.number().min(0).max(200).optional().nullable(),
  bloodProducts: z.number().min(0).max(200).optional().nullable(),
  medications: z.number().min(0).max(100).optional().nullable(),
  enteral: z.number().min(0).max(200).optional().nullable(),

  // Output (mL)
  urine: z.number().min(0).max(500).optional().nullable(),
  stool: z.number().min(0).max(200).optional().nullable(),
  emesis: z.number().min(0).max(200).optional().nullable(),
  gastricOutput: z.number().min(0).max(200).optional().nullable(),
  ostomyOutput: z.number().min(0).max(200).optional().nullable(),
  drainOutput: z.number().min(0).max(200).optional().nullable(),

  // Stool characteristics
  stoolCount: z.number().int().min(0).max(20).optional().nullable(),
  stoolType: z.enum(['meconium', 'transitional', 'normal', 'loose', 'watery']).optional().nullable(),

  // Urine characteristics
  urineCount: z.number().int().min(0).max(20).optional().nullable(),
  specificGravity: z.number().min(1.0).max(1.04).optional().nullable(),

  notes: z.string().max(500).optional().nullable(),
  recordedBy: z.string().max(100).optional().nullable(),
});

// Schema for updating flowsheet entry
const updateFlowsheetSchema = createFlowsheetSchema.partial().omit({
  patientId: true,
  shiftDate: true,
  hour: true,
});

// GET /api/flowsheet - Get flowsheet entries for a patient/date
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryResult = flowsheetQuerySchema.safeParse({
    patientId: searchParams.get('patientId'),
    date: searchParams.get('date'),
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

  const { patientId, date, startDate, endDate } = queryResult.data;
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

  // If specific date is provided, use it
  if (date) {
    const dateStart = new Date(date + 'T00:00:00.000Z');
    const dateEnd = new Date(date + 'T23:59:59.999Z');
    where.shiftDate = {
      gte: dateStart,
      lte: dateEnd,
    };
  } else {
    // Otherwise use date range if provided
    if (startDate) {
      where.shiftDate = {
        ...where.shiftDate,
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      where.shiftDate = {
        ...where.shiftDate,
        lte: new Date(endDate),
      };
    }

    // Default to last 24 hours if no date specified
    if (!startDate && !endDate) {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      where.shiftDate = {
        gte: yesterday,
      };
    }
  }

  // Fetch flowsheet entries
  const entries = await prisma.flowsheetEntry.findMany({
    where,
    orderBy: [
      { shiftDate: 'asc' },
      { hour: 'asc' },
    ],
  });

  // Transform to response format
  const transformed = entries.map(e => ({
    id: e.id,
    patientId: e.patientId,
    shiftDate: formatDate(e.shiftDate),
    hour: e.hour,
    // Intake
    ivFluids: e.ivFluids,
    tpn: e.tpn,
    lipids: e.lipids,
    bloodProducts: e.bloodProducts,
    medications: e.medications,
    enteral: e.enteral,
    // Output
    urine: e.urine,
    stool: e.stool,
    emesis: e.emesis,
    gastricOutput: e.gastricOutput,
    ostomyOutput: e.ostomyOutput,
    drainOutput: e.drainOutput,
    // Characteristics
    stoolCount: e.stoolCount,
    stoolType: e.stoolType,
    urineCount: e.urineCount,
    specificGravity: e.specificGravity,
    notes: e.notes,
    recordedBy: e.recordedBy,
    recordedAt: e.recordedAt.toISOString(),
  }));

  // Calculate I/O totals
  const ioSummary = calculateIOSummary(entries, patient.currentWeight);

  logger.info('Flowsheet entries fetched', {
    userId: session.user.id,
    patientId: parsedPatientId,
    date: date || 'range',
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
      ioSummary,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/flowsheet - Add or update a flowsheet entry
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Only clinical staff can add flowsheet entries
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse', 'Charge Nurse', 'Staff Nurse', 'Physician', 'Admin']);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validationResult = createFlowsheetSchema.safeParse(body);
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
    shiftDate,
    hour,
    ivFluids,
    tpn,
    lipids,
    bloodProducts,
    medications,
    enteral,
    urine,
    stool,
    emesis,
    gastricOutput,
    ostomyOutput,
    drainOutput,
    stoolCount,
    stoolType,
    urineCount,
    specificGravity,
    notes,
    recordedBy,
  } = validationResult.data;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, name: true, mrn: true },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Parse the shift date
  const parsedShiftDate = new Date(shiftDate + 'T00:00:00.000Z');

  // Check if entry already exists for this patient/date/hour
  const existingEntry = await prisma.flowsheetEntry.findUnique({
    where: {
      patientId_shiftDate_hour: {
        patientId,
        shiftDate: parsedShiftDate,
        hour,
      },
    },
  });

  let entry;
  let action;

  if (existingEntry) {
    // Update existing entry (upsert behavior)
    entry = await prisma.flowsheetEntry.update({
      where: { id: existingEntry.id },
      data: {
        ivFluids: ivFluids ?? existingEntry.ivFluids,
        tpn: tpn ?? existingEntry.tpn,
        lipids: lipids ?? existingEntry.lipids,
        bloodProducts: bloodProducts ?? existingEntry.bloodProducts,
        medications: medications ?? existingEntry.medications,
        enteral: enteral ?? existingEntry.enteral,
        urine: urine ?? existingEntry.urine,
        stool: stool ?? existingEntry.stool,
        emesis: emesis ?? existingEntry.emesis,
        gastricOutput: gastricOutput ?? existingEntry.gastricOutput,
        ostomyOutput: ostomyOutput ?? existingEntry.ostomyOutput,
        drainOutput: drainOutput ?? existingEntry.drainOutput,
        stoolCount: stoolCount ?? existingEntry.stoolCount,
        stoolType: stoolType ?? existingEntry.stoolType,
        urineCount: urineCount ?? existingEntry.urineCount,
        specificGravity: specificGravity ?? existingEntry.specificGravity,
        notes: notes ?? existingEntry.notes,
        recordedBy: recordedBy || session.user.name || session.user.email,
        recordedAt: new Date(),
      },
    });
    action = 'update_flowsheet_entry';
  } else {
    // Create new entry
    entry = await prisma.flowsheetEntry.create({
      data: {
        patientId,
        shiftDate: parsedShiftDate,
        hour,
        ivFluids,
        tpn,
        lipids,
        bloodProducts,
        medications,
        enteral,
        urine,
        stool,
        emesis,
        gastricOutput,
        ostomyOutput,
        drainOutput,
        stoolCount,
        stoolType,
        urineCount,
        specificGravity,
        notes,
        recordedBy: recordedBy || session.user.name || session.user.email,
      },
    });
    action = 'create_flowsheet_entry';
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action,
      resource: 'flowsheet_entry',
      resourceId: entry.id,
      details: JSON.stringify({
        patientId,
        shiftDate,
        hour,
        totalIntake: calculateTotalIntake(entry),
        totalOutput: calculateTotalOutput(entry),
      }),
    },
  });

  logger.audit('Flowsheet entry recorded', {
    userId: session.user.id,
    patientId,
    entryId: entry.id,
    shiftDate,
    hour,
    action,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      id: entry.id,
      patientId: entry.patientId,
      shiftDate: formatDate(entry.shiftDate),
      hour: entry.hour,
      ivFluids: entry.ivFluids,
      tpn: entry.tpn,
      lipids: entry.lipids,
      bloodProducts: entry.bloodProducts,
      medications: entry.medications,
      enteral: entry.enteral,
      urine: entry.urine,
      stool: entry.stool,
      emesis: entry.emesis,
      gastricOutput: entry.gastricOutput,
      ostomyOutput: entry.ostomyOutput,
      drainOutput: entry.drainOutput,
      stoolCount: entry.stoolCount,
      stoolType: entry.stoolType,
      urineCount: entry.urineCount,
      specificGravity: entry.specificGravity,
      notes: entry.notes,
      recordedBy: entry.recordedBy,
      recordedAt: entry.recordedAt.toISOString(),
      totalIntake: calculateTotalIntake(entry),
      totalOutput: calculateTotalOutput(entry),
    },
    meta: {
      message: existingEntry ? 'Flowsheet entry updated successfully' : 'Flowsheet entry created successfully',
      patientName: patient.name,
      isUpdate: !!existingEntry,
      timestamp: new Date().toISOString(),
    },
  }, { status: existingEntry ? 200 : 201 });
});

// Helper function to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Helper function to calculate total intake
function calculateTotalIntake(entry) {
  return (
    (entry.ivFluids || 0) +
    (entry.tpn || 0) +
    (entry.lipids || 0) +
    (entry.bloodProducts || 0) +
    (entry.medications || 0) +
    (entry.enteral || 0)
  );
}

// Helper function to calculate total output
function calculateTotalOutput(entry) {
  return (
    (entry.urine || 0) +
    (entry.stool || 0) +
    (entry.emesis || 0) +
    (entry.gastricOutput || 0) +
    (entry.ostomyOutput || 0) +
    (entry.drainOutput || 0)
  );
}

// Helper function to calculate I/O summary
function calculateIOSummary(entries, currentWeightKg) {
  const summary = {
    totalIntake: 0,
    totalOutput: 0,
    netBalance: 0,
    intake: {
      ivFluids: 0,
      tpn: 0,
      lipids: 0,
      bloodProducts: 0,
      medications: 0,
      enteral: 0,
    },
    output: {
      urine: 0,
      stool: 0,
      emesis: 0,
      gastricOutput: 0,
      ostomyOutput: 0,
      drainOutput: 0,
    },
    stoolCount: 0,
    urineCount: 0,
    hoursRecorded: entries.length,
  };

  for (const entry of entries) {
    // Intake
    summary.intake.ivFluids += entry.ivFluids || 0;
    summary.intake.tpn += entry.tpn || 0;
    summary.intake.lipids += entry.lipids || 0;
    summary.intake.bloodProducts += entry.bloodProducts || 0;
    summary.intake.medications += entry.medications || 0;
    summary.intake.enteral += entry.enteral || 0;

    // Output
    summary.output.urine += entry.urine || 0;
    summary.output.stool += entry.stool || 0;
    summary.output.emesis += entry.emesis || 0;
    summary.output.gastricOutput += entry.gastricOutput || 0;
    summary.output.ostomyOutput += entry.ostomyOutput || 0;
    summary.output.drainOutput += entry.drainOutput || 0;

    // Counts
    summary.stoolCount += entry.stoolCount || 0;
    summary.urineCount += entry.urineCount || 0;
  }

  // Calculate totals
  summary.totalIntake = Object.values(summary.intake).reduce((a, b) => a + b, 0);
  summary.totalOutput = Object.values(summary.output).reduce((a, b) => a + b, 0);
  summary.netBalance = Math.round((summary.totalIntake - summary.totalOutput) * 10) / 10;

  // Round all values
  summary.totalIntake = Math.round(summary.totalIntake * 10) / 10;
  summary.totalOutput = Math.round(summary.totalOutput * 10) / 10;

  // Calculate mL/kg/day if we have weight
  if (currentWeightKg && currentWeightKg > 0) {
    summary.intakeMlPerKg = Math.round((summary.totalIntake / currentWeightKg) * 10) / 10;
    summary.outputMlPerKg = Math.round((summary.totalOutput / currentWeightKg) * 10) / 10;

    // Urine output in mL/kg/hr (if we have hours recorded)
    if (summary.hoursRecorded > 0) {
      summary.urineOutputMlPerKgPerHr = Math.round((summary.output.urine / currentWeightKg / summary.hoursRecorded) * 100) / 100;
    }
  }

  return summary;
}
