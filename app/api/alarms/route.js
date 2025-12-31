import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { alarmActionSchema, validateRequest, schemas } from '@/lib/validation';
import { withErrorHandler, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { z } from 'zod';

// Query params schema for GET
const alarmsQuerySchema = z.object({
  status: z.enum(['active', 'acknowledged', 'silenced', 'resolved', 'all']).default('active'),
  type: z.enum(['critical', 'warning', 'advisory']).optional(),
});

// GET /api/alarms - Get active alarms
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);

  // Parse pagination parameters
  const { limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 50,
    maxLimit: 200, // Allow more alarms since they're important for monitoring
  });

  // Parse and validate query parameters
  const queryResult = alarmsQuerySchema.safeParse({
    status: searchParams.get('status') || 'active',
    type: searchParams.get('type') || undefined,
  });

  const { status, type } = queryResult.success ? queryResult.data : { status: 'active', type: undefined };

  const where = {};
  if (status !== 'all') {
    where.status = status;
  }
  if (type) {
    where.type = type;
  }

  // Execute query, total count, and type counts in parallel
  // Using select instead of include to minimize data transfer (N+1 prevention)
  const [alarms, total, typeCounts] = await Promise.all([
    prisma.alarm.findMany({
      where,
      select: {
        id: true,
        patientId: true,
        type: true,
        parameter: true,
        value: true,
        threshold: true,
        message: true,
        status: true,
        triggeredAt: true,
        resolvedAt: true,
        silencedUntil: true,
        // Only select needed fields from patient (not full object)
        patient: {
          select: {
            name: true,
            bed: {
              select: { bedNumber: true },
            },
          },
        },
        // Get only the latest acknowledgment with just the user name
        acknowledgments: {
          select: {
            user: {
              select: { fullName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { type: 'asc' }, // critical first
        { triggeredAt: 'desc' },
      ],
      skip: offset,
      take: limit,
    }),
    prisma.alarm.count({ where }),
    // Get type counts using groupBy instead of JS filtering (N+1 fix)
    prisma.alarm.groupBy({
      by: ['type'],
      where: { ...where, status: 'active' },
      _count: true,
    }),
  ]);

  // Transform for frontend
  const transformed = alarms.map(alarm => ({
    id: alarm.id,
    patientId: alarm.patientId,
    bed: alarm.patient.bed?.bedNumber || '--',
    patientName: alarm.patient.name,
    type: alarm.type,
    parameter: alarm.parameter,
    value: alarm.value,
    threshold: alarm.threshold,
    message: alarm.message,
    status: alarm.status,
    triggeredAt: alarm.triggeredAt.toISOString(),
    resolvedAt: alarm.resolvedAt?.toISOString(),
    silencedUntil: alarm.silencedUntil?.toISOString(),
    acknowledgedBy: alarm.acknowledgments[0]?.user?.fullName,
  }));

  // Extract counts from groupBy result (more efficient than JS filtering)
  const typeCountMap = typeCounts.reduce((acc, item) => {
    acc[item.type] = item._count;
    return acc;
  }, {});
  const criticalCount = typeCountMap.critical || 0;
  const warningCount = typeCountMap.warning || 0;

  logger.info('Alarms fetched', {
    userId: session.user.id,
    count: transformed.length,
    total,
    limit,
    offset,
    critical: criticalCount,
    warning: warningCount,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json(
    createPaginatedResponse({
      data: transformed,
      total,
      limit,
      offset,
      additionalMeta: {
        critical: criticalCount,
        warning: warningCount,
      },
    })
  );
});

// POST /api/alarms - Acknowledge or silence alarms
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(alarmActionSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const { action, alarmIds, silenceDuration } = validation.data;
  const userId = parseInt(session.user.id);

  // Batch fetch all alarms at once instead of individual queries (N+1 fix)
  const existingAlarms = await prisma.alarm.findMany({
    where: { id: { in: alarmIds } },
    select: { id: true },
  });

  const existingAlarmIds = new Set(existingAlarms.map(a => a.id));
  const notFound = alarmIds.filter(id => !existingAlarmIds.has(id));
  const validAlarmIds = alarmIds.filter(id => existingAlarmIds.has(id));

  if (validAlarmIds.length === 0) {
    return NextResponse.json({
      message: `No valid alarms found`,
      data: [],
      meta: {
        processed: 0,
        notFound: notFound.length > 0 ? notFound : undefined,
      }
    });
  }

  // Prepare update data based on action
  let updateData = {};
  if (action === 'acknowledge') {
    updateData.status = 'acknowledged';
  } else if (action === 'silence') {
    const silenceUntil = new Date();
    silenceUntil.setSeconds(silenceUntil.getSeconds() + silenceDuration);
    updateData.status = 'silenced';
    updateData.silencedUntil = silenceUntil;
  } else if (action === 'resolve') {
    updateData.status = 'resolved';
    updateData.resolvedAt = new Date();
  }

  // Use transaction to batch all operations (N+1 fix - from ~4N queries to ~4 queries)
  const results = await prisma.$transaction(async (tx) => {
    // Batch update all alarms at once
    await tx.alarm.updateMany({
      where: { id: { in: validAlarmIds } },
      data: updateData,
    });

    // Batch create acknowledgments
    await tx.alarmAcknowledgment.createMany({
      data: validAlarmIds.map(alarmId => ({
        alarmId,
        userId,
        action,
      })),
    });

    // Batch create audit logs
    await tx.auditLog.createMany({
      data: validAlarmIds.map(alarmId => ({
        userId,
        action: `${action}_alarm`,
        resource: 'alarm',
        resourceId: alarmId,
      })),
    });

    // Fetch updated alarms for response
    return tx.alarm.findMany({
      where: { id: { in: validAlarmIds } },
    });
  });

  logger.audit(`Alarms ${action}d`, {
    userId,
    action,
    count: results.length,
    alarmIds: validAlarmIds,
    duration: `${timer.elapsed()}ms`,
  });

  if (notFound.length > 0) {
    logger.warn('Some alarms not found during action', {
      userId,
      notFound,
    });
  }

  return NextResponse.json({
    message: `${action}d ${results.length} alarm(s)`,
    data: results,
    meta: {
      processed: results.length,
      notFound: notFound.length > 0 ? notFound : undefined,
    }
  });
});
