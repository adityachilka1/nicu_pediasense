import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { createAuditLog } from '@/lib/audit';

// GET /api/handoff/history - Get handoff history
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
  const status = searchParams.get('status');
  const authorId = searchParams.get('authorId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const daysBack = searchParams.get('daysBack');

  // Parse pagination
  const { limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 50,
    maxLimit: 200,
  });

  // Build query filters
  const where = {};

  if (patientId) {
    where.patientId = parseInt(patientId);
    if (isNaN(where.patientId)) {
      throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
    }
  }

  if (shift) {
    const validShifts = ['day', 'evening', 'night'];
    if (validShifts.includes(shift)) {
      where.shift = shift;
    }
  }

  if (status) {
    const validStatuses = ['draft', 'submitted', 'acknowledged'];
    if (validStatuses.includes(status)) {
      where.status = status;
    }
  }

  if (authorId) {
    where.authorId = parseInt(authorId);
    if (isNaN(where.authorId)) {
      throw new ValidationError([{ field: 'authorId', message: 'Invalid author ID' }]);
    }
  }

  // Date range filter
  if (startDate || endDate || daysBack) {
    where.shiftDate = {};

    if (daysBack) {
      const days = parseInt(daysBack);
      if (!isNaN(days) && days > 0) {
        const startDateTime = new Date();
        startDateTime.setDate(startDateTime.getDate() - days);
        startDateTime.setHours(0, 0, 0, 0);
        where.shiftDate.gte = startDateTime;
      }
    }

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        where.shiftDate.gte = start;
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        where.shiftDate.lte = end;
      }
    }
  }

  // Execute query
  const [handoffNotes, total] = await Promise.all([
    prisma.handoffNote.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            name: true,
            status: true,
            gestationalAge: true,
            dayOfLife: true,
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
      orderBy: [
        { shiftDate: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: offset,
      take: limit,
    }),
    prisma.handoffNote.count({ where }),
  ]);

  // Transform notes
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

  // Get summary statistics
  const stats = await prisma.handoffNote.groupBy({
    by: ['status', 'shift'],
    where,
    _count: true,
  });

  // Format stats
  const statusCounts = stats.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + item._count;
    return acc;
  }, {});

  const shiftCounts = stats.reduce((acc, item) => {
    acc[item.shift] = (acc[item.shift] || 0) + item._count;
    return acc;
  }, {});

  // Audit log for PHI access (if patient-specific)
  if (patientId) {
    await createAuditLog({
      userId: parseInt(session.user.id),
      action: 'view_handoff_history',
      resource: 'patient',
      resourceId: parseInt(patientId),
      details: JSON.stringify({ recordCount: transformed.length }),
      ipAddress: clientIP,
    });
  }

  logger.info('Fetched handoff history', {
    userId: session.user.id,
    patientId,
    shift,
    status,
    count: transformed.length,
    total,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json(
    createPaginatedResponse({
      data: transformed,
      total,
      limit,
      offset,
      additionalMeta: {
        filters: {
          patientId,
          shift,
          status,
          authorId,
          startDate,
          endDate,
          daysBack,
        },
        stats: {
          byStatus: statusCounts,
          byShift: shiftCounts,
        },
        shifts: ['day', 'evening', 'night'],
        statuses: ['draft', 'submitted', 'acknowledged'],
      },
    })
  );
});
