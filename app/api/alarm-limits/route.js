import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { updateAlarmLimitsSchema, alarmLimitSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';

// Default alarm limit presets for NICU (hardcoded fallback)
const DEFAULT_PRESETS = {
  preterm_24_28: {
    name: 'preterm_24_28',
    displayName: 'Preterm (24-28 weeks)',
    description: 'Alarm limits for extremely preterm infants (24-28 weeks gestational age)',
    limits: {
      spo2: [88, 95],
      pr: [100, 190],
      rr: [30, 80],
      temp: [36.3, 37.3],
    },
    isDefault: false,
  },
  preterm_28_32: {
    name: 'preterm_28_32',
    displayName: 'Preterm (28-32 weeks)',
    description: 'Alarm limits for very preterm infants (28-32 weeks gestational age)',
    limits: {
      spo2: [88, 96],
      pr: [100, 180],
      rr: [30, 70],
      temp: [36.4, 37.4],
    },
    isDefault: false,
  },
  preterm_32_37: {
    name: 'preterm_32_37',
    displayName: 'Preterm (32-37 weeks)',
    description: 'Alarm limits for moderate to late preterm infants (32-37 weeks gestational age)',
    limits: {
      spo2: [90, 98],
      pr: [90, 170],
      rr: [25, 60],
      temp: [36.5, 37.5],
    },
    isDefault: false,
  },
  term: {
    name: 'term',
    displayName: 'Term Infant',
    description: 'Alarm limits for term infants (37+ weeks gestational age)',
    limits: {
      spo2: [92, 100],
      pr: [80, 160],
      rr: [20, 60],
      temp: [36.5, 37.5],
    },
    isDefault: true,
  },
};

// Helper to determine recommended preset based on gestational age
function getRecommendedPreset(gestationalAge) {
  if (!gestationalAge) return 'term';

  // Parse gestational age (format: "32+4" means 32 weeks and 4 days)
  const match = gestationalAge.match(/^(\d+)\+?(\d)?$/);
  if (!match) return 'term';

  const weeks = parseInt(match[1], 10);

  if (weeks < 28) return 'preterm_24_28';
  if (weeks < 32) return 'preterm_28_32';
  if (weeks < 37) return 'preterm_32_37';
  return 'term';
}

// GET /api/alarm-limits - Get alarm limits (default presets or patient-specific)
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const presetName = searchParams.get('preset');
  const includePresets = searchParams.get('includePresets') !== 'false'; // default true

  // If requesting a specific preset
  if (presetName) {
    // First try to get from database
    const dbPreset = await prisma.alarmLimitPreset.findUnique({
      where: { name: presetName },
    });

    if (dbPreset) {
      return NextResponse.json({
        data: {
          name: dbPreset.name,
          displayName: dbPreset.displayName,
          description: dbPreset.description,
          limits: JSON.parse(dbPreset.limits),
          isDefault: dbPreset.isDefault,
          source: 'database',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Fall back to hardcoded preset
    const preset = DEFAULT_PRESETS[presetName];
    if (!preset) {
      throw new NotFoundError(`Alarm preset "${presetName}"`);
    }

    return NextResponse.json({
      data: {
        ...preset,
        source: 'default',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  // If requesting patient-specific limits
  if (patientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: parseInt(patientId, 10) },
      select: {
        id: true,
        mrn: true,
        name: true,
        gestationalAge: true,
        alarmLimits: true,
        status: true,
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient');
    }

    const patientLimits = patient.alarmLimits ? JSON.parse(patient.alarmLimits) : null;
    const recommendedPreset = getRecommendedPreset(patient.gestationalAge);
    const defaultLimits = DEFAULT_PRESETS[recommendedPreset]?.limits || DEFAULT_PRESETS.term.limits;

    // Merge patient-specific limits with defaults
    const effectiveLimits = patientLimits
      ? { ...defaultLimits, ...patientLimits }
      : defaultLimits;

    logger.info('Fetched patient alarm limits', {
      userId: session.user.id,
      patientId: patient.id,
      hasCustomLimits: !!patientLimits,
      recommendedPreset,
      duration: `${timer.elapsed()}ms`,
    });

    return NextResponse.json({
      data: {
        patient: {
          id: patient.id,
          mrn: patient.mrn,
          name: patient.name,
          gestationalAge: patient.gestationalAge,
        },
        limits: effectiveLimits,
        customLimits: patientLimits,
        recommendedPreset,
        isCustom: !!patientLimits,
      },
      meta: {
        presets: includePresets ? Object.keys(DEFAULT_PRESETS).map(key => ({
          name: key,
          displayName: DEFAULT_PRESETS[key].displayName,
          isDefault: DEFAULT_PRESETS[key].isDefault,
        })) : undefined,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Return all presets (both from DB and defaults)
  let presets = [];

  // Try to get presets from database
  const dbPresets = await prisma.alarmLimitPreset.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  if (dbPresets.length > 0) {
    presets = dbPresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      displayName: preset.displayName,
      description: preset.description,
      limits: JSON.parse(preset.limits),
      isDefault: preset.isDefault,
      source: 'database',
    }));
  } else {
    // Use hardcoded defaults
    presets = Object.entries(DEFAULT_PRESETS).map(([key, preset]) => ({
      name: key,
      displayName: preset.displayName,
      description: preset.description,
      limits: preset.limits,
      isDefault: preset.isDefault,
      source: 'default',
    }));
  }

  logger.info('Fetched alarm limit presets', {
    userId: session.user.id,
    count: presets.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: presets,
    meta: {
      total: presets.length,
      parameters: {
        spo2: { unit: '%', description: 'Oxygen saturation' },
        pr: { unit: 'bpm', description: 'Pulse rate / Heart rate' },
        rr: { unit: 'breaths/min', description: 'Respiratory rate' },
        temp: { unit: 'C', description: 'Temperature' },
        fio2: { unit: '%', description: 'Fraction of inspired oxygen' },
        pi: { unit: '', description: 'Perfusion index' },
        bpSystolic: { unit: 'mmHg', description: 'Systolic blood pressure' },
        bpDiastolic: { unit: 'mmHg', description: 'Diastolic blood pressure' },
        bpMean: { unit: 'mmHg', description: 'Mean arterial pressure' },
      },
      timestamp: new Date().toISOString(),
    },
  });
});

// PUT /api/alarm-limits - Update alarm limits for a patient
export const PUT = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Only physicians, charge nurses, and admins can update alarm limits
  requireRole(session, ['admin', 'Admin', 'physician', 'Physician', 'charge_nurse', 'Charge Nurse']);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(updateAlarmLimitsSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const { patientId, limits, presetId } = validation.data;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // If presetId is provided, apply preset limits
  let effectiveLimits = limits;
  let appliedPreset = null;

  if (presetId) {
    const preset = await prisma.alarmLimitPreset.findUnique({
      where: { id: presetId },
    });

    if (preset) {
      const presetLimits = JSON.parse(preset.limits);
      effectiveLimits = { ...presetLimits, ...limits };
      appliedPreset = preset.name;
    }
  }

  // Validate that limits have correct format (min < max)
  for (const [param, range] of Object.entries(effectiveLimits || {})) {
    if (range && Array.isArray(range) && range.length === 2) {
      if (range[0] > range[1]) {
        throw new ValidationError([{
          field: `limits.${param}`,
          message: `Lower limit cannot be greater than upper limit for ${param}`,
        }]);
      }
    }
  }

  // Store previous limits for audit
  const previousLimits = patient.alarmLimits ? JSON.parse(patient.alarmLimits) : null;

  // Update patient alarm limits
  const updatedPatient = await prisma.patient.update({
    where: { id: patientId },
    data: {
      alarmLimits: JSON.stringify(effectiveLimits),
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'update_alarm_limits',
      resource: 'patient',
      resourceId: patientId,
      details: JSON.stringify({
        previousLimits,
        newLimits: effectiveLimits,
        appliedPreset,
      }),
    },
  });

  logger.audit('Alarm limits updated', {
    userId: session.user.id,
    patientId,
    mrn: patient.mrn,
    appliedPreset,
    changedParams: Object.keys(effectiveLimits || {}),
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      patient: {
        id: updatedPatient.id,
        mrn: patient.mrn,
        name: patient.name,
      },
      limits: effectiveLimits,
      appliedPreset,
      previousLimits,
    },
    meta: {
      action: 'updated',
      timestamp: new Date().toISOString(),
    },
  });
});
