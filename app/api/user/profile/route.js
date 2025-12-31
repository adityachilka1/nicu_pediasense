import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth } from '@/lib/security';
import { z } from 'zod';

// Schema for updating profile
const updateProfileSchema = z.object({
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less')
    .regex(/^[A-Za-z\s,.'()-]+$/, 'Name contains invalid characters')
    .optional(),
  initials: z.string()
    .max(5, 'Initials must be 5 characters or less')
    .regex(/^[A-Za-z]+$/, 'Initials must be letters only')
    .optional()
    .nullable(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    notifications: z.object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      alarmSounds: z.boolean().optional(),
    }).optional(),
    dashboard: z.object({
      defaultView: z.enum(['grid', 'list', 'compact']).optional(),
      refreshInterval: z.number().int().min(5).max(300).optional(),
      showVitals: z.boolean().optional(),
    }).optional(),
    locale: z.string().max(10).optional(),
    timezone: z.string().max(50).optional(),
  }).optional(),
}).strict();

// GET /api/user/profile - Get current user's profile
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const userId = parseInt(session.user.id, 10);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      initials: true,
      active: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // Get user preferences from a separate query or parse from stored JSON
  // For now, we'll check if there's a UserPreferences model or store in user
  // Since schema doesn't have preferences, we'll simulate with reasonable defaults
  const preferences = await getUserPreferences(userId);

  const profile = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    initials: user.initials,
    active: user.active,
    lastLogin: user.lastLogin?.toISOString() || null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    preferences,
  };

  logger.info('User profile fetched', {
    userId: session.user.id,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: profile,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// PUT /api/user/profile - Update current user's profile
export const PUT = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const userId = parseInt(session.user.id, 10);

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validationResult = updateProfileSchema.safeParse(body);
  if (!validationResult.success) {
    const errors = (validationResult.error?.errors || []).map(err => ({
      field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
      message: err.message || 'Validation error',
    }));
    throw new ValidationError(errors);
  }

  const { fullName, initials, preferences } = validationResult.data;

  // Check user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new NotFoundError('User');
  }

  // Build update data
  const updateData = {};
  if (fullName !== undefined) {
    updateData.fullName = fullName;
  }
  if (initials !== undefined) {
    updateData.initials = initials;
  }

  // Update user record
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      initials: true,
      active: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Store preferences (in a real app, this would go to a preferences table)
  if (preferences) {
    await saveUserPreferences(userId, preferences);
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'update_profile',
      resource: 'user',
      resourceId: userId,
      details: JSON.stringify({
        updated: Object.keys(updateData),
        preferencesUpdated: preferences ? Object.keys(preferences) : [],
      }),
      ipAddress: clientIP,
    },
  });

  // Fetch updated preferences
  const updatedPreferences = await getUserPreferences(userId);

  const profile = {
    id: updatedUser.id,
    email: updatedUser.email,
    fullName: updatedUser.fullName,
    role: updatedUser.role,
    initials: updatedUser.initials,
    active: updatedUser.active,
    lastLogin: updatedUser.lastLogin?.toISOString() || null,
    createdAt: updatedUser.createdAt.toISOString(),
    updatedAt: updatedUser.updatedAt.toISOString(),
    preferences: updatedPreferences,
  };

  logger.audit('User profile updated', {
    userId: session.user.id,
    updatedFields: Object.keys(updateData),
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: profile,
    meta: {
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString(),
    },
  });
});

// Helper functions for user preferences
// In production, these would use a UserPreferences table or similar

// In-memory store for development (use Redis/DB in production)
const preferencesStore = new Map();

async function getUserPreferences(userId) {
  // Check in-memory store first
  if (preferencesStore.has(userId)) {
    return preferencesStore.get(userId);
  }

  // Return default preferences
  return {
    theme: 'system',
    notifications: {
      email: true,
      push: true,
      alarmSounds: true,
    },
    dashboard: {
      defaultView: 'grid',
      refreshInterval: 30,
      showVitals: true,
    },
    locale: 'en-US',
    timezone: 'UTC',
  };
}

async function saveUserPreferences(userId, newPreferences) {
  const existingPreferences = await getUserPreferences(userId);

  // Deep merge preferences
  const mergedPreferences = {
    ...existingPreferences,
    ...newPreferences,
    notifications: {
      ...existingPreferences.notifications,
      ...(newPreferences.notifications || {}),
    },
    dashboard: {
      ...existingPreferences.dashboard,
      ...(newPreferences.dashboard || {}),
    },
  };

  preferencesStore.set(userId, mergedPreferences);
  return mergedPreferences;
}
