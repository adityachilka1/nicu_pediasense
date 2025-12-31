import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { z } from 'zod';

// Query params schema for audit logs
const auditLogsQuerySchema = z.object({
  userId: z.string().regex(/^\d+$/, 'userId must be numeric').optional(),
  action: z.string().max(100).optional(),
  resource: z.string().max(50).optional(),
  dateFrom: z.string().datetime({ message: 'Invalid dateFrom format' }).optional(),
  dateTo: z.string().datetime({ message: 'Invalid dateTo format' }).optional(),
  page: z.string().regex(/^\d+$/, 'page must be numeric').default('1'),
  limit: z.string().regex(/^\d+$/, 'limit must be numeric').default('50'),
});

// GET /api/audit-logs - List audit logs with filtering and pagination
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Only admins can view audit logs
  requireRole(session, ROLE_GROUPS.ADMIN_ONLY);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryResult = auditLogsQuerySchema.safeParse({
    userId: searchParams.get('userId') || undefined,
    action: searchParams.get('action') || undefined,
    resource: searchParams.get('resource') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    page: searchParams.get('page') || '1',
    limit: searchParams.get('limit') || '50',
  });

  if (!queryResult.success) {
    const errors = (queryResult.error?.errors || []).map(err => ({
      field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
      message: err.message || 'Validation error',
    }));
    throw new ValidationError(errors);
  }

  const { userId, action, resource, dateFrom, dateTo } = queryResult.data;

  // Parse pagination using standardized utility
  const { limit: limitNum, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 50,
    maxLimit: 100,
  });

  // Build where clause
  const where = {};

  if (userId) {
    where.userId = parseInt(userId, 10);
  }

  if (action) {
    where.action = {
      contains: action,
    };
  }

  if (resource) {
    where.resource = resource;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      where.createdAt.lte = new Date(dateTo);
    }
  }

  // Execute queries in parallel
  const [auditLogs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Transform for response
  const transformed = auditLogs.map(log => ({
    id: log.id,
    userId: log.userId,
    user: log.user ? {
      id: log.user.id,
      email: log.user.email,
      fullName: log.user.fullName,
      role: log.user.role,
    } : null,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    details: log.details ? JSON.parse(log.details) : null,
    ipAddress: log.ipAddress,
    createdAt: log.createdAt.toISOString(),
  }));

  logger.info('Audit logs fetched', {
    userId: session.user.id,
    filters: { userId, action, resource, dateFrom, dateTo },
    count: transformed.length,
    total: totalCount,
    limit: limitNum,
    offset,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json(
    createPaginatedResponse({
      data: transformed,
      total: totalCount,
      limit: limitNum,
      offset,
    })
  );
});
