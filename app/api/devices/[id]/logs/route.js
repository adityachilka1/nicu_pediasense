import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createDeviceLogSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';

// GET /api/devices/[id]/logs - Get logs for a specific device
export const GET = withErrorHandler(async (request, context) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // Get device ID from route params
  const { params } = context;
  const deviceId = parseInt(params.id, 10);

  if (isNaN(deviceId)) {
    throw new ValidationError([{ field: 'id', message: 'Invalid device ID' }]);
  }

  // Verify device exists
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      serialNumber: true,
      name: true,
      type: true,
      status: true,
    },
  });

  if (!device) {
    throw new NotFoundError('Device');
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level');
  const category = searchParams.get('category');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const orderBy = searchParams.get('orderBy') || 'desc'; // asc or desc

  // Build where clause
  const where = {
    deviceId,
  };

  if (level) {
    where.level = level;
  }

  if (category) {
    where.category = category;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  // Get total count for pagination
  const totalCount = await prisma.deviceLog.count({ where });

  // Fetch logs
  const logs = await prisma.deviceLog.findMany({
    where,
    orderBy: { createdAt: orderBy === 'asc' ? 'asc' : 'desc' },
    skip: offset,
    take: limit,
  });

  // Transform logs
  const transformed = logs.map((log) => ({
    id: log.id,
    level: log.level,
    category: log.category,
    message: log.message,
    details: log.details ? JSON.parse(log.details) : null,
    userId: log.userId,
    createdAt: log.createdAt,
  }));

  // Get stats by level and category
  const statsByLevel = await prisma.deviceLog.groupBy({
    by: ['level'],
    where: { deviceId },
    _count: true,
  });

  const statsByCategory = await prisma.deviceLog.groupBy({
    by: ['category'],
    where: { deviceId },
    _count: true,
  });

  logger.info('Fetched device logs', {
    userId: session.user.id,
    deviceId,
    count: transformed.length,
    filters: { level, category, startDate, endDate },
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    meta: {
      device: {
        id: device.id,
        serialNumber: device.serialNumber,
        name: device.name,
        type: device.type,
        status: device.status,
      },
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + logs.length < totalCount,
      },
      stats: {
        byLevel: Object.fromEntries(statsByLevel.map((s) => [s.level, s._count])),
        byCategory: Object.fromEntries(statsByCategory.map((s) => [s.category, s._count])),
      },
      filters: { level, category, startDate, endDate },
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/devices/[id]/logs - Add a log entry for a device
export const POST = withErrorHandler(async (request, context) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // Get device ID from route params
  const { params } = context;
  const deviceId = parseInt(params.id, 10);

  if (isNaN(deviceId)) {
    throw new ValidationError([{ field: 'id', message: 'Invalid device ID' }]);
  }

  // Verify device exists
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      serialNumber: true,
      name: true,
      status: true,
    },
  });

  if (!device) {
    throw new NotFoundError('Device');
  }

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(createDeviceLogSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const { level, category, message, details } = validation.data;

  // Create the log entry
  const log = await prisma.deviceLog.create({
    data: {
      deviceId,
      level,
      category,
      message,
      details: details ? JSON.stringify(details) : null,
      userId: parseInt(session.user.id),
    },
  });

  // Update device lastPingAt for certain categories
  const pingCategories = ['connection', 'data_transmission', 'status_change'];
  if (pingCategories.includes(category)) {
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastPingAt: new Date() },
    });
  }

  // If this is an error or critical log, update device status
  if ((level === 'error' || level === 'critical') && category === 'error') {
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: 'error' },
    });

    // Create audit log for status change
    await prisma.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'device_error',
        resource: 'device',
        resourceId: deviceId,
        details: JSON.stringify({
          serialNumber: device.serialNumber,
          level,
          message,
        }),
      },
    });
  }

  logger.info('Device log entry created', {
    userId: session.user.id,
    deviceId,
    serialNumber: device.serialNumber,
    level,
    category,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      id: log.id,
      deviceId: log.deviceId,
      level: log.level,
      category: log.category,
      message: log.message,
      details: log.details ? JSON.parse(log.details) : null,
      userId: log.userId,
      createdAt: log.createdAt,
    },
    meta: {
      device: {
        id: device.id,
        serialNumber: device.serialNumber,
        name: device.name,
      },
      action: 'created',
      timestamp: new Date().toISOString(),
    },
  }, { status: 201 });
});
