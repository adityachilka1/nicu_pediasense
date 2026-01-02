import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { z } from 'zod';

// Schema for updating flowsheet entry
const updateFlowsheetSchema = z.object({
  // Intake (mL) - all optional for partial updates
  ivFluids: z.number().min(0, 'IV fluids must be >= 0').max(500, 'IV fluids must be <= 500 mL').optional().nullable(),
  tpn: z.number().min(0, 'TPN must be >= 0').max(500, 'TPN must be <= 500 mL').optional().nullable(),
  lipids: z.number().min(0, 'Lipids must be >= 0').max(200, 'Lipids must be <= 200 mL').optional().nullable(),
  bloodProducts: z.number().min(0, 'Blood products must be >= 0').max(200, 'Blood products must be <= 200 mL').optional().nullable(),
  medications: z.number().min(0, 'Medications must be >= 0').max(100, 'Medications must be <= 100 mL').optional().nullable(),
  enteral: z.number().min(0, 'Enteral must be >= 0').max(200, 'Enteral must be <= 200 mL').optional().nullable(),

  // Output (mL) - all optional for partial updates
  urine: z.number().min(0, 'Urine must be >= 0').max(500, 'Urine must be <= 500 mL').optional().nullable(),
  stool: z.number().min(0, 'Stool must be >= 0').max(200, 'Stool must be <= 200 mL').optional().nullable(),
  emesis: z.number().min(0, 'Emesis must be >= 0').max(200, 'Emesis must be <= 200 mL').optional().nullable(),
  gastricOutput: z.number().min(0, 'Gastric output must be >= 0').max(200, 'Gastric output must be <= 200 mL').optional().nullable(),
  ostomyOutput: z.number().min(0, 'Ostomy output must be >= 0').max(200, 'Ostomy output must be <= 200 mL').optional().nullable(),
  drainOutput: z.number().min(0, 'Drain output must be >= 0').max(200, 'Drain output must be <= 200 mL').optional().nullable(),

  // Stool characteristics
  stoolCount: z.number().int('Stool count must be a whole number').min(0).max(20).optional().nullable(),
  stoolType: z.enum(['meconium', 'transitional', 'normal', 'loose', 'watery']).optional().nullable(),

  // Urine characteristics
  urineCount: z.number().int('Urine count must be a whole number').min(0).max(20).optional().nullable(),
  specificGravity: z.number().min(1.0, 'Specific gravity must be >= 1.0').max(1.04, 'Specific gravity must be <= 1.04').optional().nullable(),

  // Notes
  notes: z.string().max(500, 'Notes must be <= 500 characters').optional().nullable(),
});

// GET /api/flowsheet/entry/[entryId] - Get a single entry
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // Validate entry ID
  const entryId = parseInt(params.entryId, 10);
  if (isNaN(entryId) || entryId <= 0) {
    throw new ValidationError([{ field: 'entryId', message: 'Entry ID must be a positive integer' }]);
  }

  // Fetch the entry with patient data
  const entry = await prisma.flowsheetEntry.findUnique({
    where: { id: entryId },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          mrn: true,
          currentWeight: true,
        },
      },
    },
  });

  if (!entry) {
    throw new NotFoundError('Flowsheet entry');
  }

  logger.info('Flowsheet entry retrieved', {
    userId: session.user.id,
    entryId,
    patientId: entry.patientId,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      id: entry.id,
      patientId: entry.patientId,
      shiftDate: entry.shiftDate.toISOString().split('T')[0],
      hour: entry.hour,
      hourFormatted: `${String(entry.hour).padStart(2, '0')}:00`,

      // Intake
      intake: {
        iv: entry.ivFluids,
        tpn: entry.tpn,
        lipids: entry.lipids,
        bloodProducts: entry.bloodProducts,
        meds: entry.medications,
        feeds: entry.enteral,
      },

      // Output
      output: {
        urine: entry.urine,
        stool: entry.stool,
        emesis: entry.emesis,
        gastric: entry.gastricOutput,
        ostomy: entry.ostomyOutput,
        drain: entry.drainOutput,
      },

      // Characteristics
      stoolCount: entry.stoolCount,
      stoolType: entry.stoolType,
      urineCount: entry.urineCount,
      specificGravity: entry.specificGravity,

      notes: entry.notes,
      recordedBy: entry.recordedBy,
      recordedAt: entry.recordedAt?.toISOString(),
    },
    meta: {
      patient: entry.patient,
      timestamp: new Date().toISOString(),
    },
  });
});

// PUT /api/flowsheet/entry/[entryId] - Update a flowsheet entry
export const PUT = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Only clinical staff can update flowsheet entries
  requireRole(session, [...ROLE_GROUPS.ALL_CLINICAL, 'Charge Nurse', 'Staff Nurse', 'Physician', 'Admin']);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Validate entry ID
  const entryId = parseInt(params.entryId, 10);
  if (isNaN(entryId) || entryId <= 0) {
    throw new ValidationError([{ field: 'entryId', message: 'Entry ID must be a positive integer' }]);
  }

  // Fetch existing entry
  const existingEntry = await prisma.flowsheetEntry.findUnique({
    where: { id: entryId },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          mrn: true,
        },
      },
    },
  });

  if (!existingEntry) {
    throw new NotFoundError('Flowsheet entry');
  }

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validationResult = updateFlowsheetSchema.safeParse(body);
  if (!validationResult.success) {
    const errors = validationResult.error?.errors || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const updateData = validationResult.data;

  // Build update object with only provided fields
  const fieldsToUpdate = {};
  const updatedFields = [];

  // Map intake fields
  if (updateData.ivFluids !== undefined) {
    fieldsToUpdate.ivFluids = updateData.ivFluids;
    updatedFields.push('ivFluids');
  }
  if (updateData.tpn !== undefined) {
    fieldsToUpdate.tpn = updateData.tpn;
    updatedFields.push('tpn');
  }
  if (updateData.lipids !== undefined) {
    fieldsToUpdate.lipids = updateData.lipids;
    updatedFields.push('lipids');
  }
  if (updateData.bloodProducts !== undefined) {
    fieldsToUpdate.bloodProducts = updateData.bloodProducts;
    updatedFields.push('bloodProducts');
  }
  if (updateData.medications !== undefined) {
    fieldsToUpdate.medications = updateData.medications;
    updatedFields.push('medications');
  }
  if (updateData.enteral !== undefined) {
    fieldsToUpdate.enteral = updateData.enteral;
    updatedFields.push('enteral');
  }

  // Map output fields
  if (updateData.urine !== undefined) {
    fieldsToUpdate.urine = updateData.urine;
    updatedFields.push('urine');
  }
  if (updateData.stool !== undefined) {
    fieldsToUpdate.stool = updateData.stool;
    updatedFields.push('stool');
  }
  if (updateData.emesis !== undefined) {
    fieldsToUpdate.emesis = updateData.emesis;
    updatedFields.push('emesis');
  }
  if (updateData.gastricOutput !== undefined) {
    fieldsToUpdate.gastricOutput = updateData.gastricOutput;
    updatedFields.push('gastricOutput');
  }
  if (updateData.ostomyOutput !== undefined) {
    fieldsToUpdate.ostomyOutput = updateData.ostomyOutput;
    updatedFields.push('ostomyOutput');
  }
  if (updateData.drainOutput !== undefined) {
    fieldsToUpdate.drainOutput = updateData.drainOutput;
    updatedFields.push('drainOutput');
  }

  // Map characteristic fields
  if (updateData.stoolCount !== undefined) {
    fieldsToUpdate.stoolCount = updateData.stoolCount;
    updatedFields.push('stoolCount');
  }
  if (updateData.stoolType !== undefined) {
    fieldsToUpdate.stoolType = updateData.stoolType;
    updatedFields.push('stoolType');
  }
  if (updateData.urineCount !== undefined) {
    fieldsToUpdate.urineCount = updateData.urineCount;
    updatedFields.push('urineCount');
  }
  if (updateData.specificGravity !== undefined) {
    fieldsToUpdate.specificGravity = updateData.specificGravity;
    updatedFields.push('specificGravity');
  }
  if (updateData.notes !== undefined) {
    fieldsToUpdate.notes = updateData.notes;
    updatedFields.push('notes');
  }

  // Always update recorded by/at for audit trail
  fieldsToUpdate.recordedBy = session.user.name || session.user.email;
  fieldsToUpdate.recordedAt = new Date();

  // Perform the update
  const updatedEntry = await prisma.flowsheetEntry.update({
    where: { id: entryId },
    data: fieldsToUpdate,
  });

  // Calculate new totals for the entry
  const totalIntake = (updatedEntry.ivFluids || 0) + (updatedEntry.tpn || 0) +
                      (updatedEntry.lipids || 0) + (updatedEntry.bloodProducts || 0) +
                      (updatedEntry.medications || 0) + (updatedEntry.enteral || 0);
  const totalOutput = (updatedEntry.urine || 0) + (updatedEntry.stool || 0) +
                      (updatedEntry.emesis || 0) + (updatedEntry.gastricOutput || 0) +
                      (updatedEntry.ostomyOutput || 0) + (updatedEntry.drainOutput || 0);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'update_flowsheet_entry',
      resource: 'flowsheet_entry',
      resourceId: entryId,
      details: JSON.stringify({
        patientId: existingEntry.patientId,
        patientMrn: existingEntry.patient.mrn,
        shiftDate: existingEntry.shiftDate.toISOString().split('T')[0],
        hour: existingEntry.hour,
        updatedFields,
        previousValues: {
          totalIntake: calculateEntryTotal(existingEntry, 'intake'),
          totalOutput: calculateEntryTotal(existingEntry, 'output'),
        },
        newValues: {
          totalIntake,
          totalOutput,
        },
      }),
    },
  });

  logger.audit('Flowsheet entry updated', {
    userId: session.user.id,
    entryId,
    patientId: existingEntry.patientId,
    patientMrn: existingEntry.patient.mrn,
    shiftDate: existingEntry.shiftDate.toISOString().split('T')[0],
    hour: existingEntry.hour,
    updatedFields,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      id: updatedEntry.id,
      patientId: updatedEntry.patientId,
      shiftDate: updatedEntry.shiftDate.toISOString().split('T')[0],
      hour: updatedEntry.hour,
      hourFormatted: `${String(updatedEntry.hour).padStart(2, '0')}:00`,

      // Intake
      intake: {
        iv: updatedEntry.ivFluids,
        tpn: updatedEntry.tpn,
        lipids: updatedEntry.lipids,
        bloodProducts: updatedEntry.bloodProducts,
        meds: updatedEntry.medications,
        feeds: updatedEntry.enteral,
        total: totalIntake,
      },

      // Output
      output: {
        urine: updatedEntry.urine,
        stool: updatedEntry.stool,
        emesis: updatedEntry.emesis,
        gastric: updatedEntry.gastricOutput,
        ostomy: updatedEntry.ostomyOutput,
        drain: updatedEntry.drainOutput,
        total: totalOutput,
      },

      // Characteristics
      stoolCount: updatedEntry.stoolCount,
      stoolType: updatedEntry.stoolType,
      urineCount: updatedEntry.urineCount,
      specificGravity: updatedEntry.specificGravity,

      notes: updatedEntry.notes,
      recordedBy: updatedEntry.recordedBy,
      recordedAt: updatedEntry.recordedAt?.toISOString(),
    },
    meta: {
      message: 'Flowsheet entry updated successfully',
      updatedFields,
      patientName: existingEntry.patient.name,
      timestamp: new Date().toISOString(),
    },
  });
});

// DELETE /api/flowsheet/entry/[entryId] - Delete a flowsheet entry (admin only)
export const DELETE = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Only admins and physicians can delete entries
  requireRole(session, ['admin', 'physician', 'Admin', 'Physician']);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Validate entry ID
  const entryId = parseInt(params.entryId, 10);
  if (isNaN(entryId) || entryId <= 0) {
    throw new ValidationError([{ field: 'entryId', message: 'Entry ID must be a positive integer' }]);
  }

  // Fetch existing entry
  const existingEntry = await prisma.flowsheetEntry.findUnique({
    where: { id: entryId },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          mrn: true,
        },
      },
    },
  });

  if (!existingEntry) {
    throw new NotFoundError('Flowsheet entry');
  }

  // Delete the entry
  await prisma.flowsheetEntry.delete({
    where: { id: entryId },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'delete_flowsheet_entry',
      resource: 'flowsheet_entry',
      resourceId: entryId,
      details: JSON.stringify({
        patientId: existingEntry.patientId,
        patientMrn: existingEntry.patient.mrn,
        shiftDate: existingEntry.shiftDate.toISOString().split('T')[0],
        hour: existingEntry.hour,
        deletedData: {
          intake: calculateEntryTotal(existingEntry, 'intake'),
          output: calculateEntryTotal(existingEntry, 'output'),
        },
      }),
    },
  });

  logger.audit('Flowsheet entry deleted', {
    userId: session.user.id,
    entryId,
    patientId: existingEntry.patientId,
    patientMrn: existingEntry.patient.mrn,
    shiftDate: existingEntry.shiftDate.toISOString().split('T')[0],
    hour: existingEntry.hour,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: null,
    meta: {
      message: 'Flowsheet entry deleted successfully',
      entryId,
      patientName: existingEntry.patient.name,
      timestamp: new Date().toISOString(),
    },
  });
});

// Helper to calculate entry totals
function calculateEntryTotal(entry, type) {
  if (type === 'intake') {
    return (entry.ivFluids || 0) + (entry.tpn || 0) + (entry.lipids || 0) +
           (entry.bloodProducts || 0) + (entry.medications || 0) + (entry.enteral || 0);
  } else {
    return (entry.urine || 0) + (entry.stool || 0) + (entry.emesis || 0) +
           (entry.gastricOutput || 0) + (entry.ostomyOutput || 0) + (entry.drainOutput || 0);
  }
}
