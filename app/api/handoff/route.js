import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createHandoffNoteSchema, updateHandoffNoteSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';

// Helper to determine current shift based on time (returns uppercase Prisma enum)
function getCurrentShift(date = new Date()) {
  const hours = date.getHours();
  if (hours >= 7 && hours < 15) return 'DAY';
  if (hours >= 15 && hours < 23) return 'EVENING';
  return 'NIGHT';
}

// Map lowercase shift input to uppercase Prisma enum
function mapShiftToEnum(shift) {
  const shiftMap = {
    day: 'DAY',
    evening: 'EVENING',
    night: 'NIGHT',
    DAY: 'DAY',
    EVENING: 'EVENING',
    NIGHT: 'NIGHT',
  };
  return shiftMap[shift] || shift?.toUpperCase();
}

// Map lowercase status input to uppercase Prisma enum
function mapStatusToEnum(status) {
  const statusMap = {
    draft: 'DRAFT',
    submitted: 'SUBMITTED',
    acknowledged: 'ACKNOWLEDGED',
    archived: 'ARCHIVED',
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    ARCHIVED: 'ARCHIVED',
  };
  return statusMap[status] || status?.toUpperCase();
}

// Map lowercase acuity input to uppercase Prisma enum
function mapAcuityToEnum(acuity) {
  if (!acuity) return null;
  const acuityMap = {
    stable: 'STABLE',
    moderate: 'MODERATE',
    critical: 'CRITICAL',
    unstable: 'UNSTABLE',
    STABLE: 'STABLE',
    MODERATE: 'MODERATE',
    CRITICAL: 'CRITICAL',
    UNSTABLE: 'UNSTABLE',
  };
  return acuityMap[acuity] || acuity?.toUpperCase();
}

// Helper to get shift start date
function getShiftDate(date = new Date()) {
  const shiftDate = new Date(date);
  // If it's before 7am, it's still the previous day's night shift
  if (shiftDate.getHours() < 7) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }
  shiftDate.setHours(0, 0, 0, 0);
  return shiftDate;
}

// GET /api/handoff - Get handoff notes
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const shift = searchParams.get('shift');
  const date = searchParams.get('date');
  const status = searchParams.get('status');
  const authorId = searchParams.get('authorId');
  const limit = parseInt(searchParams.get('limit')) || 50;

  // Build query filters
  const where = {};

  if (patientId) {
    where.patientId = parseInt(patientId);
  }

  if (shift) {
    const validShifts = ['day', 'evening', 'night', 'DAY', 'EVENING', 'NIGHT'];
    if (validShifts.includes(shift)) {
      where.shift = mapShiftToEnum(shift);
    }
  }

  if (date) {
    // Get notes for a specific date
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    where.shiftDate = {
      gte: targetDate,
      lt: nextDay,
    };
  }

  if (status) {
    const validStatuses = ['draft', 'submitted', 'acknowledged', 'DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'];
    if (validStatuses.includes(status)) {
      where.status = mapStatusToEnum(status);
    }
  }

  if (authorId) {
    where.authorId = parseInt(authorId);
  }

  // Fetch handoff notes
  const handoffNotes = await prisma.handoffNote.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          mrn: true,
          name: true,
          status: true,
          bed: {
            select: {
              bedNumber: true,
            },
          },
        },
      },
      author: {
        select: {
          id: true,
          fullName: true,
          initials: true,
          role: true,
        },
      },
      acknowledgedBy: {
        select: {
          id: true,
          fullName: true,
          initials: true,
        },
      },
    },
    orderBy: [
      { shiftDate: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  // Transform notes with parsed JSON fields
  const transformed = handoffNotes.map(note => ({
    ...note,
    keyEvents: note.keyEvents ? JSON.parse(note.keyEvents) : [],
    pendingTasks: note.pendingTasks ? JSON.parse(note.pendingTasks) : [],
    alertsFlags: note.alertsFlags ? JSON.parse(note.alertsFlags) : [],
    patient: {
      ...note.patient,
      bed: note.patient.bed?.bedNumber || '--',
    },
  }));

  // Get shift summary
  const currentShift = getCurrentShift();
  const currentShiftDate = getShiftDate();

  const shiftSummary = await prisma.handoffNote.groupBy({
    by: ['status'],
    where: {
      shift: currentShift,
      shiftDate: {
        gte: currentShiftDate,
        lt: new Date(currentShiftDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    _count: true,
  });

  logger.info('Fetched handoff notes', {
    userId: session.user.id,
    patientId,
    shift,
    count: transformed.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    meta: {
      total: transformed.length,
      currentShift,
      currentShiftDate: currentShiftDate.toISOString(),
      shiftSummary: shiftSummary.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      shifts: ['day', 'evening', 'night'],
      shiftTimes: {
        day: '07:00 - 15:00',
        evening: '15:00 - 23:00',
        night: '23:00 - 07:00',
      },
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/handoff - Create a new handoff note
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Clinical staff can create handoff notes
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse', 'Physician', 'Charge Nurse', 'Staff Nurse', 'Admin']);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(createHandoffNoteSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const {
    patientId,
    shift: inputShift,
    shiftDate,
    situation,
    background,
    assessment,
    recommendation,
    acuity: inputAcuity,
    keyEvents,
    pendingTasks,
    alertsFlags,
    status: inputStatus,
  } = validation.data;

  // Map to uppercase Prisma enum values
  const shift = mapShiftToEnum(inputShift);
  const status = inputStatus ? mapStatusToEnum(inputStatus) : 'DRAFT';
  const acuity = mapAcuityToEnum(inputAcuity);

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });
  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Check for existing handoff note for same patient/shift/date
  const shiftDateObj = new Date(shiftDate);
  shiftDateObj.setHours(0, 0, 0, 0);
  const nextDay = new Date(shiftDateObj);
  nextDay.setDate(nextDay.getDate() + 1);

  const existingNote = await prisma.handoffNote.findFirst({
    where: {
      patientId,
      shift,
      shiftDate: {
        gte: shiftDateObj,
        lt: nextDay,
      },
      authorId: parseInt(session.user.id),
    },
  });

  if (existingNote) {
    // Update existing draft instead of creating new
    if (existingNote.status === 'DRAFT') {
      const updatedNote = await prisma.handoffNote.update({
        where: { id: existingNote.id },
        data: {
          situation,
          background,
          assessment,
          recommendation,
          acuity,
          keyEvents: keyEvents ? JSON.stringify(keyEvents) : null,
          pendingTasks: pendingTasks ? JSON.stringify(pendingTasks) : null,
          alertsFlags: alertsFlags ? JSON.stringify(alertsFlags) : null,
          status: status,
        },
        include: {
          patient: {
            select: {
              id: true,
              mrn: true,
              name: true,
            },
          },
          author: {
            select: {
              id: true,
              fullName: true,
              initials: true,
              role: true,
            },
          },
        },
      });

      logger.info('Updated existing handoff note', {
        userId: session.user.id,
        handoffNoteId: updatedNote.id,
        patientId,
        shift,
        duration: `${timer.elapsed()}ms`,
      });

      return NextResponse.json({
        data: {
          ...updatedNote,
          keyEvents: updatedNote.keyEvents ? JSON.parse(updatedNote.keyEvents) : [],
          pendingTasks: updatedNote.pendingTasks ? JSON.parse(updatedNote.pendingTasks) : [],
          alertsFlags: updatedNote.alertsFlags ? JSON.parse(updatedNote.alertsFlags) : [],
        },
        meta: {
          updated: true,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Create new handoff note
  const handoffNote = await prisma.handoffNote.create({
    data: {
      patientId,
      authorId: parseInt(session.user.id),
      shift,
      shiftDate: shiftDateObj,
      situation,
      background,
      assessment,
      recommendation,
      acuity,
      keyEvents: keyEvents ? JSON.stringify(keyEvents) : null,
      pendingTasks: pendingTasks ? JSON.stringify(pendingTasks) : null,
      alertsFlags: alertsFlags ? JSON.stringify(alertsFlags) : null,
      status: status,
    },
    include: {
      patient: {
        select: {
          id: true,
          mrn: true,
          name: true,
        },
      },
      author: {
        select: {
          id: true,
          fullName: true,
          initials: true,
          role: true,
        },
      },
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'create_handoff_note',
      resource: 'handoff_note',
      resourceId: handoffNote.id,
      details: JSON.stringify({
        patientId,
        shift,
        shiftDate: shiftDateObj.toISOString(),
        status: status,
      }),
    },
  });

  logger.audit('Handoff note created', {
    userId: session.user.id,
    handoffNoteId: handoffNote.id,
    patientId,
    shift,
    shiftDate: shiftDateObj.toISOString(),
    duration: `${timer.elapsed()}ms`,
  });

  // Transform response
  const response = {
    ...handoffNote,
    keyEvents: handoffNote.keyEvents ? JSON.parse(handoffNote.keyEvents) : [],
    pendingTasks: handoffNote.pendingTasks ? JSON.parse(handoffNote.pendingTasks) : [],
    alertsFlags: handoffNote.alertsFlags ? JSON.parse(handoffNote.alertsFlags) : [],
  };

  return NextResponse.json({ data: response }, { status: 201 });
});

// PUT /api/handoff - Update handoff note (submit or acknowledge)
export const PUT = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse', 'Physician', 'Charge Nurse', 'Staff Nurse', 'Admin']);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const { handoffNoteId, action } = body;

  if (!handoffNoteId) {
    throw new ValidationError([{ field: 'handoffNoteId', message: 'Handoff note ID is required' }]);
  }

  // Find the handoff note
  const existingNote = await prisma.handoffNote.findUnique({
    where: { id: parseInt(handoffNoteId) },
  });

  if (!existingNote) {
    throw new NotFoundError('Handoff note');
  }

  let updateData = {};
  let auditAction = 'update_handoff_note';

  // Handle specific actions
  if (action === 'submit') {
    // Submit the handoff note
    if (existingNote.status !== 'DRAFT') {
      throw new ValidationError([{ field: 'status', message: 'Can only submit draft notes' }]);
    }
    updateData.status = 'SUBMITTED';
    auditAction = 'submit_handoff_note';
  } else if (action === 'acknowledge') {
    // Acknowledge the handoff note
    if (existingNote.status !== 'SUBMITTED') {
      throw new ValidationError([{ field: 'status', message: 'Can only acknowledge submitted notes' }]);
    }
    updateData.status = 'ACKNOWLEDGED';
    updateData.acknowledgedAt = new Date();
    updateData.acknowledgedById = parseInt(session.user.id);
    auditAction = 'acknowledge_handoff_note';
  } else {
    // Regular update
    const validation = validateRequest(updateHandoffNoteSchema, body);
    if (!validation.success) {
      throw new ValidationError(validation.errors);
    }

    // Can only update draft notes
    if (existingNote.status !== 'DRAFT') {
      throw new ValidationError([{ field: 'status', message: 'Can only update draft notes' }]);
    }

    if (validation.data.situation !== undefined) updateData.situation = validation.data.situation;
    if (validation.data.background !== undefined) updateData.background = validation.data.background;
    if (validation.data.assessment !== undefined) updateData.assessment = validation.data.assessment;
    if (validation.data.recommendation !== undefined) updateData.recommendation = validation.data.recommendation;
    if (validation.data.acuity !== undefined) updateData.acuity = mapAcuityToEnum(validation.data.acuity);
    if (validation.data.keyEvents !== undefined) {
      updateData.keyEvents = JSON.stringify(validation.data.keyEvents);
    }
    if (validation.data.pendingTasks !== undefined) {
      updateData.pendingTasks = JSON.stringify(validation.data.pendingTasks);
    }
    if (validation.data.alertsFlags !== undefined) {
      updateData.alertsFlags = JSON.stringify(validation.data.alertsFlags);
    }
    if (validation.data.status !== undefined) updateData.status = mapStatusToEnum(validation.data.status);
  }

  // Update handoff note
  const updatedNote = await prisma.handoffNote.update({
    where: { id: parseInt(handoffNoteId) },
    data: updateData,
    include: {
      patient: {
        select: {
          id: true,
          mrn: true,
          name: true,
          bed: {
            select: {
              bedNumber: true,
            },
          },
        },
      },
      author: {
        select: {
          id: true,
          fullName: true,
          initials: true,
          role: true,
        },
      },
      acknowledgedBy: {
        select: {
          id: true,
          fullName: true,
          initials: true,
        },
      },
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: auditAction,
      resource: 'handoff_note',
      resourceId: updatedNote.id,
      details: JSON.stringify({
        previousStatus: existingNote.status,
        newStatus: updateData.status || existingNote.status,
        action,
      }),
    },
  });

  logger.audit('Handoff note updated', {
    userId: session.user.id,
    handoffNoteId: updatedNote.id,
    patientId: updatedNote.patientId,
    action,
    previousStatus: existingNote.status,
    newStatus: updateData.status || existingNote.status,
    duration: `${timer.elapsed()}ms`,
  });

  // Transform response
  const response = {
    ...updatedNote,
    keyEvents: updatedNote.keyEvents ? JSON.parse(updatedNote.keyEvents) : [],
    pendingTasks: updatedNote.pendingTasks ? JSON.parse(updatedNote.pendingTasks) : [],
    alertsFlags: updatedNote.alertsFlags ? JSON.parse(updatedNote.alertsFlags) : [],
    patient: {
      ...updatedNote.patient,
      bed: updatedNote.patient.bed?.bedNumber || '--',
    },
  };

  return NextResponse.json({
    data: response,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});
