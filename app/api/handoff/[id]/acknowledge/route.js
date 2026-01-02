import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { createAuditLog } from '@/lib/audit';

// PUT /api/handoff/[id]/acknowledge - Acknowledge a handoff note
export const PUT = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Clinical staff can acknowledge handoffs
  requireRole(session, ROLE_GROUPS.ALL_CLINICAL);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const handoffId = parseInt(params.id);
  if (isNaN(handoffId)) {
    throw new ValidationError([{ field: 'id', message: 'Invalid handoff ID' }]);
  }

  // Parse request body for optional signature/notes
  const rawBody = await request.json().catch(() => ({}));
  const body = sanitizeInput(rawBody);

  const { signature, notes } = body;

  // Find the handoff note
  const existingNote = await prisma.handoffNote.findUnique({
    where: { id: handoffId },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          mrn: true,
          bed: {
            select: { bedNumber: true },
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
    },
  });

  if (!existingNote) {
    throw new NotFoundError('Handoff note');
  }

  // Validate status transition
  if (existingNote.status === 'acknowledged') {
    throw new ValidationError([{
      field: 'status',
      message: 'Handoff has already been acknowledged'
    }]);
  }

  if (existingNote.status === 'draft') {
    throw new ValidationError([{
      field: 'status',
      message: 'Cannot acknowledge a draft handoff. It must be submitted first.'
    }]);
  }

  // Prevent self-acknowledgment in production
  if (process.env.NODE_ENV === 'production' && existingNote.authorId === parseInt(session.user.id)) {
    throw new ValidationError([{
      field: 'authorId',
      message: 'Cannot acknowledge your own handoff note'
    }]);
  }

  // Update handoff note
  const updatedNote = await prisma.handoffNote.update({
    where: { id: handoffId },
    data: {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedById: parseInt(session.user.id),
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          mrn: true,
          bed: {
            select: { bedNumber: true },
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
          role: true,
        },
      },
    },
  });

  // Create audit log
  await createAuditLog({
    userId: parseInt(session.user.id),
    action: 'acknowledge_handoff',
    resource: 'handoff_note',
    resourceId: handoffId,
    details: JSON.stringify({
      patientId: existingNote.patientId,
      patientName: existingNote.patient.name,
      shift: existingNote.shift,
      shiftDate: existingNote.shiftDate,
      authorId: existingNote.authorId,
      authorName: existingNote.author.fullName,
      signature: signature ? '[PROVIDED]' : '[NONE]',
      notes: notes ? '[PROVIDED]' : '[NONE]',
    }),
    ipAddress: clientIP,
  });

  logger.audit('Handoff acknowledged', {
    userId: session.user.id,
    handoffId,
    patientId: existingNote.patientId,
    shift: existingNote.shift,
    authorId: existingNote.authorId,
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
      acknowledged: true,
      acknowledgedAt: updatedNote.acknowledgedAt,
      acknowledgedBy: updatedNote.acknowledgedBy,
      timestamp: new Date().toISOString(),
    },
  });
});
