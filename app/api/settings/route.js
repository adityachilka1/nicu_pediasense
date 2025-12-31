import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth } from '@/lib/security';
import { z } from 'zod';

// Schema for user settings
const updateSettingsSchema = z.object({
  // Display settings
  display: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    fontSize: z.enum(['small', 'medium', 'large']).optional(),
    density: z.enum(['comfortable', 'compact']).optional(),
    colorBlindMode: z.boolean().optional(),
    highContrastMode: z.boolean().optional(),
  }).optional(),

  // Notification settings
  notifications: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    alarmSounds: z.boolean().optional(),
    alarmVolume: z.number().int().min(0).max(100).optional(),
    criticalAlarmsOnly: z.boolean().optional(),
    quietHours: z.object({
      enabled: z.boolean().optional(),
      start: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
      end: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
    }).optional(),
  }).optional(),

  // Dashboard settings
  dashboard: z.object({
    defaultView: z.enum(['grid', 'list', 'compact']).optional(),
    refreshInterval: z.number().int().min(5).max(300).optional(),
    showVitals: z.boolean().optional(),
    showAlarms: z.boolean().optional(),
    showNotes: z.boolean().optional(),
    patientsPerPage: z.number().int().min(6).max(50).optional(),
    autoExpandPatient: z.boolean().optional(),
  }).optional(),

  // Alarm display settings
  alarms: z.object({
    showAcknowledged: z.boolean().optional(),
    showResolved: z.boolean().optional(),
    sortBy: z.enum(['time', 'severity', 'patient']).optional(),
    groupByPatient: z.boolean().optional(),
    defaultSilenceDuration: z.number().int().min(30).max(600).optional(),
  }).optional(),

  // Localization
  localization: z.object({
    locale: z.string().max(10).optional(),
    timezone: z.string().max(50).optional(),
    dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    temperatureUnit: z.enum(['celsius', 'fahrenheit']).optional(),
    weightUnit: z.enum(['kg', 'lb']).optional(),
  }).optional(),

  // Accessibility settings
  accessibility: z.object({
    reduceMotion: z.boolean().optional(),
    screenReaderOptimized: z.boolean().optional(),
    keyboardShortcuts: z.boolean().optional(),
  }).optional(),
}).strict();

// In-memory settings store (use Redis/DB in production)
const settingsStore = new Map();

// Default settings
const defaultSettings = {
  display: {
    theme: 'system',
    fontSize: 'medium',
    density: 'comfortable',
    colorBlindMode: false,
    highContrastMode: false,
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: true,
    alarmSounds: true,
    alarmVolume: 80,
    criticalAlarmsOnly: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '07:00',
    },
  },
  dashboard: {
    defaultView: 'grid',
    refreshInterval: 30,
    showVitals: true,
    showAlarms: true,
    showNotes: true,
    patientsPerPage: 12,
    autoExpandPatient: false,
  },
  alarms: {
    showAcknowledged: false,
    showResolved: false,
    sortBy: 'severity',
    groupByPatient: false,
    defaultSilenceDuration: 120,
  },
  localization: {
    locale: 'en-US',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    temperatureUnit: 'celsius',
    weightUnit: 'kg',
  },
  accessibility: {
    reduceMotion: false,
    screenReaderOptimized: false,
    keyboardShortcuts: true,
  },
};

// Helper to deep merge settings
function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }

  return result;
}

// Helper to get user settings
async function getUserSettings(userId) {
  if (settingsStore.has(userId)) {
    return settingsStore.get(userId);
  }
  return { ...defaultSettings };
}

// Helper to save user settings
async function saveUserSettings(userId, settings) {
  const existingSettings = await getUserSettings(userId);
  const mergedSettings = deepMerge(existingSettings, settings);
  settingsStore.set(userId, mergedSettings);
  return mergedSettings;
}

// GET /api/settings - Get current user's settings
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const userId = parseInt(session.user.id, 10);

  // Get user settings
  const settings = await getUserSettings(userId);

  logger.info('User settings fetched', {
    userId: session.user.id,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: settings,
    meta: {
      userId,
      timestamp: new Date().toISOString(),
    },
  });
});

// PUT /api/settings - Update current user's settings
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

  const validationResult = updateSettingsSchema.safeParse(body);
  if (!validationResult.success) {
    const errors = (validationResult.error?.errors || []).map(err => ({
      field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
      message: err.message || 'Validation error',
    }));
    throw new ValidationError(errors);
  }

  const newSettings = validationResult.data;

  // Save settings
  const updatedSettings = await saveUserSettings(userId, newSettings);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'update_settings',
      resource: 'settings',
      resourceId: userId,
      details: JSON.stringify({
        updatedSections: Object.keys(newSettings),
      }),
      ipAddress: clientIP,
    },
  });

  logger.audit('User settings updated', {
    userId: session.user.id,
    updatedSections: Object.keys(newSettings),
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: updatedSettings,
    meta: {
      message: 'Settings updated successfully',
      userId,
      timestamp: new Date().toISOString(),
    },
  });
});

// PATCH /api/settings - Partially update settings (convenience method)
export const PATCH = PUT;
