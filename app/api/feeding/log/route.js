import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { z } from 'zod';

// Schema for creating feeding log
const createFeedingLogSchema = z.object({
  patientId: z.number().int().positive('Patient ID must be a positive integer'),
  time: z.string().optional(), // HH:MM format
  recordedAt: z.string().datetime().optional(),
  feedingType: z.enum(['breast', 'formula', 'fortified', 'tpn', 'enteral'], {
    errorMap: () => ({ message: 'Feeding type must be breast, formula, fortified, tpn, or enteral' }),
  }),
  route: z.enum(['oral', 'ng', 'og', 'gt'], {
    errorMap: () => ({ message: 'Route must be oral, ng (nasogastric), og (orogastric), or gt (gastrostomy)' }),
  }),
  volumeOrdered: z.number().min(0, 'Volume cannot be negative').max(500, 'Volume exceeds maximum').optional().nullable(),
  volumeGiven: z.number().min(0, 'Volume cannot be negative').max(500, 'Volume exceeds maximum').optional().nullable(),
  volumeResidual: z.number().min(0, 'Residual cannot be negative').max(200, 'Residual exceeds maximum').optional().nullable(),
  residualColor: z.enum(['clear', 'bilious', 'bloody', 'milky', 'yellow', 'green']).optional().nullable(),
  tolerance: z.enum(['good', 'fair', 'poor']).optional().nullable(),
  tolerated: z.boolean().optional(), // Simplified field for UI
  emesis: z.boolean().default(false),
  emesisAmount: z.number().min(0).max(200).optional().nullable(),
  fortified: z.boolean().default(false),
  calories: z.number().int().min(0).max(50).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  milk: z.string().optional(), // UI field - maps to feedingType
  method: z.string().optional(), // UI field - maps to route
});

/**
 * POST /api/feeding/log - Add a new feeding log entry
 */
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Only clinical staff can add feeding logs
  requireRole(session, ROLE_GROUPS.ALL_CLINICAL);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  // Map UI fields to schema fields
  if (body.milk && !body.feedingType) {
    body.feedingType = mapMilkToFeedingType(body.milk);
    body.fortified = body.milk.includes('HMF') || body.milk.includes('Fortified');
  }

  if (body.method && !body.route) {
    body.route = mapMethodToRoute(body.method);
  }

  if (body.tolerated !== undefined && !body.tolerance) {
    body.tolerance = body.tolerated ? 'good' : 'poor';
  }

  // Handle time field - convert to recordedAt if provided
  if (body.time && !body.recordedAt) {
    const today = new Date();
    const [hours, minutes] = body.time.split(':').map(Number);
    today.setHours(hours, minutes, 0, 0);
    body.recordedAt = today.toISOString();
  }

  const validationResult = createFeedingLogSchema.safeParse(body);
  if (!validationResult.success) {
    const errors = validationResult.error?.errors || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const data = validationResult.data;

  // Additional validation
  if (!data.volumeGiven && !data.volumeOrdered) {
    throw new ValidationError([{
      field: 'volumeGiven',
      message: 'Either volumeGiven or volumeOrdered is required',
    }]);
  }

  // Validate volume amounts
  if (data.volumeGiven && data.volumeGiven > 100) {
    // Warning for unusually high volumes for NICU patients
    logger.warn('Unusually high feeding volume recorded', {
      patientId: data.patientId,
      volumeGiven: data.volumeGiven,
      userId: session.user.id,
    });
  }

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: data.patientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      currentWeight: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Create the feeding log
  const feedingLog = await prisma.feedingLog.create({
    data: {
      patientId: data.patientId,
      feedingType: data.feedingType,
      route: data.route,
      volumeOrdered: data.volumeOrdered,
      volumeGiven: data.volumeGiven || data.volumeOrdered,
      volumeResidual: data.volumeResidual,
      residualColor: data.residualColor,
      tolerance: data.tolerance,
      emesis: data.emesis,
      emesisAmount: data.emesis ? data.emesisAmount : null,
      fortified: data.fortified,
      calories: data.fortified ? (data.calories || 24) : null,
      notes: data.notes,
      recordedBy: session.user.name || session.user.email,
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'create_feeding_log',
      resource: 'feeding_log',
      resourceId: feedingLog.id,
      details: JSON.stringify({
        patientId: data.patientId,
        feedingType: data.feedingType,
        route: data.route,
        volumeGiven: data.volumeGiven,
        tolerance: data.tolerance,
      }),
    },
  });

  logger.audit('Feeding log recorded', {
    userId: session.user.id,
    patientId: data.patientId,
    feedingLogId: feedingLog.id,
    feedingType: data.feedingType,
    route: data.route,
    volumeGiven: data.volumeGiven,
    duration: `${timer.elapsed()}ms`,
  });

  // Transform response to match frontend expectations
  const response = {
    id: feedingLog.id,
    patientId: feedingLog.patientId,
    time: new Date(feedingLog.recordedAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    type: mapFeedingTypeToDisplay(feedingLog.feedingType),
    amount: feedingLog.volumeGiven,
    method: mapRouteToDisplay(feedingLog.route),
    milk: mapToMilkDisplay(feedingLog.feedingType, feedingLog.fortified),
    tolerated: feedingLog.tolerance !== 'poor' && !feedingLog.emesis,
    note: feedingLog.notes,
    residual: feedingLog.volumeResidual,
    residualColor: feedingLog.residualColor,
    tolerance: feedingLog.tolerance,
    emesis: feedingLog.emesis,
    emesisAmount: feedingLog.emesisAmount,
    recordedBy: feedingLog.recordedBy,
    recordedAt: feedingLog.recordedAt.toISOString(),
  };

  return NextResponse.json({
    data: response,
    meta: {
      message: 'Feeding log recorded successfully',
      patientName: patient.name,
      timestamp: new Date().toISOString(),
    },
  }, { status: 201 });
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function mapMilkToFeedingType(milk) {
  const milkLower = milk.toLowerCase();
  if (milkLower.includes('formula')) return 'formula';
  if (milkLower.includes('ebm') || milkLower.includes('breast')) {
    return milkLower.includes('hmf') || milkLower.includes('fortif') ? 'fortified' : 'breast';
  }
  if (milkLower.includes('donor')) return 'breast';
  return 'enteral';
}

function mapMethodToRoute(method) {
  const methodLower = method.toLowerCase();
  if (methodLower.includes('oral') || methodLower.includes('po') || methodLower.includes('bottle') || methodLower.includes('breast')) {
    return 'oral';
  }
  if (methodLower.includes('gavage') || methodLower.includes('ng') || methodLower.includes('nasogastric')) {
    return 'ng';
  }
  if (methodLower.includes('og') || methodLower.includes('orogastric')) {
    return 'og';
  }
  if (methodLower.includes('gt') || methodLower.includes('gastrostomy')) {
    return 'gt';
  }
  return 'ng'; // Default to NG
}

function mapFeedingTypeToDisplay(type) {
  const map = {
    breast: 'Enteral',
    formula: 'Enteral',
    fortified: 'Enteral',
    enteral: 'Enteral',
    tpn: 'Parenteral',
  };
  return map[type] || 'Enteral';
}

function mapRouteToDisplay(route) {
  const map = {
    oral: 'PO',
    ng: 'Gavage',
    og: 'Gavage',
    gt: 'GT',
  };
  return map[route] || route?.toUpperCase() || 'Gavage';
}

function mapToMilkDisplay(feedingType, fortified) {
  switch (feedingType) {
    case 'breast':
      return fortified ? 'EBM+HMF' : 'EBM';
    case 'fortified':
      return 'EBM+HMF';
    case 'formula':
      return 'Formula';
    default:
      return fortified ? 'EBM+HMF' : 'EBM';
  }
}
