import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { z } from 'zod';

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

// Query params schema for GET
const notificationsQuerySchema = z.object({
  status: z.enum(['unread', 'read', 'dismissed', 'archived', 'all']).default('unread'),
  category: z.enum(['system', 'patient', 'alarm', 'message', 'task', 'announcement', 'all']).default('all'),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'all']).default('all'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0'),
});

// Schema for creating a notification
const createNotificationSchema = z.object({
  userId: z.number().int().positive('User ID is required').optional(), // Optional - defaults to current user
  userIds: z.array(z.number().int().positive()).optional(), // For broadcast to multiple users
  title: z.string().min(1, 'Title is required').max(200),
  message: z.string().min(1, 'Message is required').max(2000),
  type: z.enum(['info', 'warning', 'alert', 'success', 'task']).default('info'),
  category: z.enum(['system', 'patient', 'alarm', 'message', 'task', 'announcement']).default('system'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  resourceType: z.enum(['patient', 'alarm', 'message', 'task']).optional().nullable(),
  resourceId: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// Schema for updating notification status (PUT)
const updateNotificationSchema = z.object({
  action: z.enum(['markRead', 'markUnread', 'dismiss', 'archive', 'markAllRead', 'dismissAll']),
  notificationIds: z.array(z.number().int().positive()).optional(),
  category: z.enum(['system', 'patient', 'alarm', 'message', 'task', 'announcement']).optional(),
});

// =====================================================
// GET /api/notifications - Get notifications for current user
// =====================================================
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryResult = notificationsQuerySchema.safeParse({
    status: searchParams.get('status') || 'unread',
    category: searchParams.get('category') || 'all',
    priority: searchParams.get('priority') || 'all',
    limit: searchParams.get('limit') || '50',
    offset: searchParams.get('offset') || '0',
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

  const { status, category, priority, limit, offset } = queryResult.data;
  const userId = parseInt(session.user.id);

  // Build where clause
  const where = {
    userId,
    // Filter out expired notifications
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ],
  };

  if (status !== 'all') {
    where.status = status;
  }
  if (category !== 'all') {
    where.category = category;
  }
  if (priority !== 'all') {
    where.priority = priority;
  }

  // Get total count for pagination
  const totalCount = await prisma.notification.count({ where });

  // Fetch notifications
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: [
      { priority: 'desc' }, // urgent first
      { createdAt: 'desc' },
    ],
    take: Math.min(limit, 100), // Cap at 100
    skip: offset,
  });

  // Transform for frontend
  const transformed = notifications.map(notification => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    category: notification.category,
    priority: notification.priority,
    resourceType: notification.resourceType,
    resourceId: notification.resourceId,
    status: notification.status,
    isRead: notification.status === 'read',
    readAt: notification.readAt?.toISOString(),
    dismissedAt: notification.dismissedAt?.toISOString(),
    expiresAt: notification.expiresAt?.toISOString(),
    createdAt: notification.createdAt.toISOString(),
    // Calculate age for display
    ageMinutes: Math.floor((Date.now() - notification.createdAt.getTime()) / 60000),
  }));

  // Get unread counts by category
  const unreadCounts = await prisma.notification.groupBy({
    by: ['category'],
    where: {
      userId,
      status: 'unread',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    _count: true,
  });

  const unreadByCategory = unreadCounts.reduce((acc, item) => {
    acc[item.category] = item._count;
    return acc;
  }, {});

  // Get total unread count
  const totalUnread = Object.values(unreadByCategory).reduce((sum, count) => sum + count, 0);

  // Count by priority for unread
  const urgentCount = transformed.filter(n => n.priority === 'urgent' && n.status === 'unread').length;
  const highCount = transformed.filter(n => n.priority === 'high' && n.status === 'unread').length;

  logger.info('Notifications fetched', {
    userId,
    status,
    category,
    count: transformed.length,
    total: totalCount,
    limit,
    offset,
    totalUnread,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json(
    createPaginatedResponse({
      data: transformed,
      total: totalCount,
      limit,
      offset,
      additionalMeta: {
        unread: {
          total: totalUnread,
          byCategory: unreadByCategory,
          urgent: urgentCount,
          high: highCount,
        },
      },
    })
  );
});

// =====================================================
// POST /api/notifications - Create notification(s)
// =====================================================
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and sanitize request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(createNotificationSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const {
    userId,
    userIds,
    title,
    message,
    type,
    category,
    priority,
    resourceType,
    resourceId,
    expiresAt,
  } = validation.data;

  const currentUserId = parseInt(session.user.id);
  let createdNotifications = [];

  // Determine target users
  let targetUserIds = [];

  if (userIds && userIds.length > 0) {
    // Broadcasting to multiple users - requires admin or charge nurse role
    requireRole(session, ['admin', 'physician', 'charge_nurse']);
    targetUserIds = userIds;
  } else if (userId) {
    // Single user notification
    targetUserIds = [userId];
  } else {
    // Default to current user (self-notification)
    targetUserIds = [currentUserId];
  }

  // Validate target users exist
  const existingUsers = await prisma.user.findMany({
    where: { id: { in: targetUserIds } },
    select: { id: true },
  });

  const existingUserIds = existingUsers.map(u => u.id);
  const notFoundUserIds = targetUserIds.filter(id => !existingUserIds.includes(id));

  if (notFoundUserIds.length > 0) {
    logger.warn('Some notification target users not found', {
      createdBy: currentUserId,
      notFoundUserIds,
    });
  }

  // Create notifications for each target user
  const notificationData = existingUserIds.map(targetUserId => ({
    userId: targetUserId,
    title,
    message,
    type,
    category,
    priority,
    resourceType: resourceType || null,
    resourceId: resourceId || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    status: 'unread',
  }));

  if (notificationData.length > 0) {
    // Use createMany for efficiency
    await prisma.notification.createMany({
      data: notificationData,
    });

    // Fetch created notifications for response
    createdNotifications = await prisma.notification.findMany({
      where: {
        userId: { in: existingUserIds },
        title,
        message,
        createdAt: { gte: new Date(Date.now() - 5000) }, // Created in last 5 seconds
      },
      orderBy: { createdAt: 'desc' },
      take: existingUserIds.length,
    });
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: currentUserId,
      action: 'create_notification',
      resource: 'notification',
      details: JSON.stringify({
        targetUsers: existingUserIds.length,
        category,
        priority,
        type,
      }),
    },
  });

  logger.audit('Notifications created', {
    createdBy: currentUserId,
    targetUsers: existingUserIds.length,
    category,
    priority,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    message: `Created ${createdNotifications.length} notification(s)`,
    data: createdNotifications,
    meta: {
      created: createdNotifications.length,
      targetUsers: existingUserIds.length,
      notFoundUsers: notFoundUserIds.length > 0 ? notFoundUserIds : undefined,
      timestamp: new Date().toISOString(),
    },
  });
});

// =====================================================
// PUT /api/notifications - Update notification status
// =====================================================
export const PUT = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // Parse and sanitize request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(updateNotificationSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const { action, notificationIds, category } = validation.data;
  const userId = parseInt(session.user.id);

  let updateResult;
  let updatedCount = 0;

  switch (action) {
    case 'markRead': {
      if (!notificationIds || notificationIds.length === 0) {
        throw new ValidationError([{ field: 'notificationIds', message: 'At least one notification ID is required' }]);
      }

      updateResult = await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId, // Ensure user owns these notifications
          status: 'unread',
        },
        data: {
          status: 'read',
          readAt: new Date(),
        },
      });
      updatedCount = updateResult.count;
      break;
    }

    case 'markUnread': {
      if (!notificationIds || notificationIds.length === 0) {
        throw new ValidationError([{ field: 'notificationIds', message: 'At least one notification ID is required' }]);
      }

      updateResult = await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
          status: 'read',
        },
        data: {
          status: 'unread',
          readAt: null,
        },
      });
      updatedCount = updateResult.count;
      break;
    }

    case 'dismiss': {
      if (!notificationIds || notificationIds.length === 0) {
        throw new ValidationError([{ field: 'notificationIds', message: 'At least one notification ID is required' }]);
      }

      updateResult = await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
          status: { not: 'dismissed' },
        },
        data: {
          status: 'dismissed',
          dismissedAt: new Date(),
        },
      });
      updatedCount = updateResult.count;
      break;
    }

    case 'archive': {
      if (!notificationIds || notificationIds.length === 0) {
        throw new ValidationError([{ field: 'notificationIds', message: 'At least one notification ID is required' }]);
      }

      updateResult = await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
        },
        data: {
          status: 'archived',
        },
      });
      updatedCount = updateResult.count;
      break;
    }

    case 'markAllRead': {
      const where = {
        userId,
        status: 'unread',
      };

      if (category) {
        where.category = category;
      }

      updateResult = await prisma.notification.updateMany({
        where,
        data: {
          status: 'read',
          readAt: new Date(),
        },
      });
      updatedCount = updateResult.count;
      break;
    }

    case 'dismissAll': {
      const where = {
        userId,
        status: { in: ['unread', 'read'] },
      };

      if (category) {
        where.category = category;
      }

      updateResult = await prisma.notification.updateMany({
        where,
        data: {
          status: 'dismissed',
          dismissedAt: new Date(),
        },
      });
      updatedCount = updateResult.count;
      break;
    }

    default:
      throw new ValidationError([{ field: 'action', message: 'Invalid action' }]);
  }

  // Get updated unread count
  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      status: 'unread',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  logger.info('Notifications updated', {
    userId,
    action,
    updatedCount,
    category: category || 'all',
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    message: `${action}: ${updatedCount} notification(s) updated`,
    data: {
      action,
      updatedCount,
      category: category || null,
    },
    meta: {
      unreadRemaining: unreadCount,
      timestamp: new Date().toISOString(),
    },
  });
});
