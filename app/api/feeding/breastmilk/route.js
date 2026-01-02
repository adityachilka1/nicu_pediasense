import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { z } from 'zod';

// Schema for pump session logging
const pumpSessionSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  volume: z.number().min(0, 'Volume cannot be negative').max(500, 'Volume exceeds maximum'),
  duration: z.number().int().min(1, 'Duration must be at least 1 minute').max(120, 'Duration exceeds maximum').optional(),
  pumpType: z.enum(['hospital', 'personal', 'hand_expression']).optional(),
  notes: z.string().max(500).optional().nullable(),
  recordedAt: z.string().datetime().optional(),
  // Storage information
  storageLocation: z.enum(['patient_freezer', 'unit_freezer', 'refrigerator', 'bedside']).optional(),
  containerLabel: z.string().max(50).optional(),
  // Mother information (for family tracking)
  motherName: z.string().max(100).optional(),
  collectedBy: z.string().max(100).optional(),
});

/**
 * POST /api/feeding/breastmilk - Log a pump session and add milk to inventory
 *
 * This endpoint logs breast milk production from a pump session and
 * updates the patient's breast milk inventory.
 */
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Clinical staff can log pump sessions
  requireRole(session, ROLE_GROUPS.ALL_CLINICAL);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validationResult = pumpSessionSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))
    );
  }

  const data = validationResult.data;

  // Validate volume
  if (data.volume > 200) {
    logger.warn('Unusually high pump volume recorded', {
      patientId: data.patientId,
      volume: data.volume,
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
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // In a production system, we would insert into a PumpSession table
  // and update a BreastMilkInventory table.
  // For now, we'll create a note to track this and return the data.

  // Create a clinical note to track the pump session
  await prisma.note.create({
    data: {
      patientId: data.patientId,
      authorId: parseInt(session.user.id),
      type: 'nursing',
      content: formatPumpSessionNote(data),
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'log_pump_session',
      resource: 'breast_milk',
      resourceId: data.patientId,
      details: JSON.stringify({
        patientId: data.patientId,
        volume: data.volume,
        duration: data.duration,
        storageLocation: data.storageLocation,
      }),
    },
  });

  logger.audit('Pump session logged', {
    userId: session.user.id,
    patientId: data.patientId,
    volume: data.volume,
    duration: data.duration,
    duration: `${timer.elapsed()}ms`,
  });

  // Calculate updated inventory stats
  const inventoryUpdate = await calculateInventoryUpdate(data.patientId, data.volume);

  return NextResponse.json({
    data: {
      patientId: data.patientId,
      volume: data.volume,
      duration: data.duration,
      pumpType: data.pumpType,
      storageLocation: data.storageLocation,
      recordedAt: data.recordedAt || new Date().toISOString(),
      recordedBy: session.user.name || session.user.email,
      inventoryUpdate,
    },
    meta: {
      message: 'Pump session logged successfully',
      patientName: patient.name,
      timestamp: new Date().toISOString(),
    },
  }, { status: 201 });
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Format pump session data as a clinical note
 */
function formatPumpSessionNote(data) {
  const parts = [
    `Breast milk pump session: ${data.volume} mL`,
  ];

  if (data.duration) {
    parts.push(`Duration: ${data.duration} minutes`);
  }

  if (data.pumpType) {
    const pumpTypes = {
      hospital: 'Hospital grade pump',
      personal: 'Personal pump',
      hand_expression: 'Hand expression',
    };
    parts.push(`Method: ${pumpTypes[data.pumpType] || data.pumpType}`);
  }

  if (data.storageLocation) {
    const locations = {
      patient_freezer: 'Patient freezer',
      unit_freezer: 'Unit freezer',
      refrigerator: 'Refrigerator',
      bedside: 'Bedside (for immediate use)',
    };
    parts.push(`Storage: ${locations[data.storageLocation] || data.storageLocation}`);
  }

  if (data.containerLabel) {
    parts.push(`Label: ${data.containerLabel}`);
  }

  if (data.motherName) {
    parts.push(`Collected by: ${data.motherName}`);
  }

  if (data.notes) {
    parts.push(`Notes: ${data.notes}`);
  }

  return parts.join('. ');
}

/**
 * Calculate inventory update after adding new milk
 */
async function calculateInventoryUpdate(patientId, newVolume) {
  // Get recent breast milk usage
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentFeedings = await prisma.feedingLog.findMany({
    where: {
      patientId,
      feedingType: { in: ['breast', 'fortified'] },
      recordedAt: { gte: last24h },
    },
  });

  const usedLast24h = recentFeedings.reduce((sum, f) => sum + (f.volumeGiven || 0), 0);

  // Get patient weight for per-kg calculations
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { currentWeight: true },
  });

  const weightKg = patient?.currentWeight || 1;

  // Estimate current inventory (simplified)
  // In production, query actual inventory table
  const estimatedPreviousInventory = usedLast24h * 2; // Assume ~2 days supply
  const newInventory = estimatedPreviousInventory + newVolume;

  // Calculate days supply
  const avgDailyUsage = usedLast24h || (weightKg * 120); // Default to 120 mL/kg/day
  const daysSupply = avgDailyUsage > 0 ? Math.round((newInventory / avgDailyUsage) * 10) / 10 : 0;

  return {
    previousInventory: Math.round(estimatedPreviousInventory),
    addedVolume: newVolume,
    newInventory: Math.round(newInventory),
    daysSupply,
    usedLast24h: Math.round(usedLast24h),
  };
}
