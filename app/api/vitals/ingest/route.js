import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP } from '@/lib/security';

/**
 * POST /api/vitals/ingest
 *
 * Ingests vitals data from OCR/camera-based extraction system.
 * This endpoint receives data from edge inference devices running
 * the ICU-Monitor-Vitals-Extractor system.
 *
 * Request Body:
 * {
 *   patientId: number,
 *   cameraId: string,
 *   vitals: {
 *     hr: number,
 *     spo2: number,
 *     rr: number,
 *     temp: number,
 *     bp?: { systolic: number, diastolic: number, map: number }
 *   },
 *   confidence: number (0-1),
 *   inferenceTimeMs: number,
 *   timestamp: ISO string,
 *   monitorType?: string,
 *   rawImagePath?: string
 * }
 */
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();

  // TODO: Implement API key authentication for edge devices
  // For now, auth check is disabled to allow Pi devices to ingest vitals
  // const session = await auth();
  const clientIP = getClientIP(request);

  // Rate limiting (more generous for automated systems)
  rateLimit(clientIP, 'heavy', { max: 1000, windowMs: 60000 });

  // Parse request body
  const body = await request.json();
  const {
    patientId,
    cameraId,
    vitals,
    confidence,
    inferenceTimeMs,
    timestamp,
    monitorType,
    rawImagePath,
  } = body;

  // Validation
  const validation = validateOcrInput(body);
  if (!validation.valid) {
    logger.warn('OCR vitals rejected - validation failed', {
      patientId,
      cameraId,
      reason: validation.reason,
      confidence,
    });

    // Log rejection for monitoring
    await logOcrRejection(body, validation);

    throw new ValidationError(validation.reason, {
      patientId,
      cameraId,
      confidence,
      errors: validation.errors
    });
  }

  // Check confidence threshold
  const CONFIDENCE_THRESHOLD = parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD || '0.85');
  if (confidence < CONFIDENCE_THRESHOLD) {
    logger.warn('OCR vitals rejected - low confidence', {
      patientId,
      cameraId,
      confidence,
      threshold: CONFIDENCE_THRESHOLD,
    });

    // Trigger manual entry alert
    await triggerManualEntryAlert(patientId, cameraId, vitals, confidence);

    // Log low confidence event
    await logLowConfidenceEvent(body);

    return NextResponse.json({
      success: false,
      error: 'Low confidence - manual entry required',
      confidence,
      threshold: CONFIDENCE_THRESHOLD,
      action: 'MANUAL_ENTRY_REQUIRED',
    }, { status: 422 });
  }

  // Plausibility checks
  const plausibilityCheck = checkPlausibility(vitals, patientId);
  if (!plausibilityCheck.valid) {
    logger.error('OCR vitals rejected - implausible reading', {
      patientId,
      cameraId,
      vitals,
      reason: plausibilityCheck.reason,
    });

    // Trigger clinical review
    await triggerClinicalReview(patientId, vitals, plausibilityCheck);

    // Log implausible reading
    await logImplausibleReading(body, plausibilityCheck);

    return NextResponse.json({
      success: false,
      error: 'Implausible reading - clinical review required',
      reason: plausibilityCheck.reason,
      action: 'CLINICAL_REVIEW_REQUIRED',
    }, { status: 422 });
  }

  // Temporal smoothing (use median of last N readings)
  const smoothedVitals = await applyTemporalSmoothing(patientId, vitals);

  // Create vital record
  const vitalRecord = await prisma.vital.create({
    data: {
      patientId,
      heartRate: smoothedVitals.hr || null,
      spo2: smoothedVitals.spo2 || null,
      respRate: smoothedVitals.rr || null,
      temperature: smoothedVitals.temp || null,
      bpSystolic: vitals.bp?.systolic || null,
      bpDiastolic: vitals.bp?.diastolic || null,
      bpMean: vitals.bp?.map || null,
      source: 'camera',
      sourceMetadata: JSON.stringify({
        cameraId,
        confidence,
        inferenceTimeMs,
        monitorType,
        rawImagePath,
        originalVitals: vitals,
        smoothedVitals: smoothedVitals,
        edgeTimestamp: timestamp,
        cloudIngestTimestamp: new Date().toISOString(),
      }),
      confidence,
      recordedAt: new Date(timestamp),
    },
  });

  // Log OCR success
  await logOcrSuccess(body, vitalRecord.id);

  // Update camera statistics
  await updateCameraStats(cameraId, confidence, inferenceTimeMs);

  // Check alarm conditions
  await checkAndTriggerAlarms(patientId, smoothedVitals, vitalRecord.id);

  logger.info('OCR vitals ingested successfully', {
    patientId,
    cameraId,
    vitalId: vitalRecord.id,
    confidence,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    success: true,
    vitalId: vitalRecord.id,
    smoothedVitals,
    confidence,
    duration: timer.elapsed(),
  });
});

/**
 * Validate OCR input data
 */
function validateOcrInput(data) {
  const errors = [];

  // Required fields
  if (!data.patientId) errors.push('patientId is required');
  if (!data.cameraId) errors.push('cameraId is required');
  if (!data.vitals) errors.push('vitals object is required');
  if (data.confidence === undefined) errors.push('confidence is required');

  // Confidence range
  if (data.confidence < 0 || data.confidence > 1) {
    errors.push('confidence must be between 0 and 1');
  }

  // Vitals structure
  if (data.vitals) {
    const { hr, spo2, rr, temp } = data.vitals;

    // At least one vital must be present
    if (!hr && !spo2 && !rr && !temp) {
      errors.push('At least one vital sign must be provided');
    }

    // Type checking
    if (hr !== undefined && typeof hr !== 'number') errors.push('hr must be a number');
    if (spo2 !== undefined && typeof spo2 !== 'number') errors.push('spo2 must be a number');
    if (rr !== undefined && typeof rr !== 'number') errors.push('rr must be a number');
    if (temp !== undefined && typeof temp !== 'number') errors.push('temp must be a number');
  }

  if (errors.length > 0) {
    return { valid: false, reason: 'Validation failed', errors };
  }

  return { valid: true };
}

/**
 * Check plausibility of vital signs for neonatal patients
 */
function checkPlausibility(vitals, patientId) {
  const ranges = {
    hr: { min: 80, max: 200, name: 'Heart Rate' },
    spo2: { min: 70, max: 100, name: 'SpO2' },
    rr: { min: 20, max: 80, name: 'Respiratory Rate' },
    temp: { min: 35.0, max: 39.0, name: 'Temperature' },
  };

  for (const [key, value] of Object.entries(vitals)) {
    if (value === null || value === undefined) continue;
    if (key === 'bp') continue; // Handle BP separately

    const range = ranges[key];
    if (!range) continue;

    if (value < range.min || value > range.max) {
      return {
        valid: false,
        reason: `${range.name} out of plausible range`,
        parameter: key,
        value,
        range: `${range.min}-${range.max}`,
      };
    }
  }

  // Blood pressure checks
  if (vitals.bp) {
    const { systolic, diastolic, map } = vitals.bp;

    if (systolic !== undefined && (systolic < 30 || systolic > 100)) {
      return {
        valid: false,
        reason: 'Systolic BP out of plausible range',
        parameter: 'bp_systolic',
        value: systolic,
        range: '30-100',
      };
    }

    if (diastolic !== undefined && (diastolic < 15 || diastolic > 70)) {
      return {
        valid: false,
        reason: 'Diastolic BP out of plausible range',
        parameter: 'bp_diastolic',
        value: diastolic,
        range: '15-70',
      };
    }

    if (map !== undefined && (map < 20 || map > 80)) {
      return {
        valid: false,
        reason: 'Mean arterial pressure out of plausible range',
        parameter: 'bp_mean',
        value: map,
        range: '20-80',
      };
    }
  }

  return { valid: true };
}

/**
 * Apply temporal smoothing (median of last N readings)
 */
async function applyTemporalSmoothing(patientId, currentVitals) {
  const WINDOW_SIZE = 5;
  const SMOOTHING_ENABLED = process.env.OCR_TEMPORAL_SMOOTHING !== 'false';

  if (!SMOOTHING_ENABLED) {
    return currentVitals;
  }

  // Get last N vitals from camera source
  const recentVitals = await prisma.vital.findMany({
    where: {
      patientId,
      source: 'camera',
    },
    orderBy: { recordedAt: 'desc' },
    take: WINDOW_SIZE - 1,
  });

  const smoothed = {};

  // Apply median smoothing to each vital
  ['hr', 'spo2', 'rr', 'temp'].forEach((key) => {
    const dbKey = key === 'hr' ? 'heartRate' : key === 'rr' ? 'respRate' : key;

    const values = [
      currentVitals[key],
      ...recentVitals.map((v) => v[dbKey]).filter((x) => x !== null),
    ].filter((x) => x !== undefined);

    if (values.length === 0) {
      smoothed[key] = currentVitals[key];
    } else {
      // Calculate median
      const sorted = values.sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      smoothed[key] = sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
    }
  });

  return smoothed;
}

/**
 * Log OCR rejection for monitoring
 */
async function logOcrRejection(data, validation) {
  try {
    await prisma.ocrLog.create({
      data: {
        patientId: data.patientId || null,
        cameraId: data.cameraId,
        confidence: data.confidence,
        inferenceTimeMs: data.inferenceTimeMs || 0,
        validationPassed: false,
        rawData: JSON.stringify({
          vitals: data.vitals,
          monitorType: data.monitorType,
          rawImagePath: data.rawImagePath,
          timestamp: data.timestamp,
        }),
        error: validation.reason,
        errorType: 'validation_error',
        screenDetected: true,
      },
    });
  } catch (error) {
    logger.error('Failed to log OCR rejection', { error: error.message });
  }
}

/**
 * Log low confidence event
 */
async function logLowConfidenceEvent(data) {
  try {
    await prisma.ocrLog.create({
      data: {
        patientId: data.patientId || null,
        cameraId: data.cameraId,
        confidence: data.confidence,
        inferenceTimeMs: data.inferenceTimeMs || 0,
        validationPassed: false,
        rawData: JSON.stringify({
          vitals: data.vitals,
          monitorType: data.monitorType,
          rawImagePath: data.rawImagePath,
          timestamp: data.timestamp,
        }),
        error: 'Confidence below threshold',
        errorType: 'low_confidence',
        screenDetected: true,
      },
    });
  } catch (error) {
    logger.error('Failed to log low confidence event', { error: error.message });
  }
}

/**
 * Log implausible reading
 */
async function logImplausibleReading(data, plausibilityCheck) {
  try {
    await prisma.ocrLog.create({
      data: {
        patientId: data.patientId || null,
        cameraId: data.cameraId,
        confidence: data.confidence,
        inferenceTimeMs: data.inferenceTimeMs || 0,
        validationPassed: false,
        rawData: JSON.stringify({
          vitals: data.vitals,
          monitorType: data.monitorType,
          rawImagePath: data.rawImagePath,
          timestamp: data.timestamp,
          plausibilityCheck,
        }),
        error: plausibilityCheck.reason,
        errorType: 'implausible_reading',
        screenDetected: true,
      },
    });
  } catch (error) {
    logger.error('Failed to log implausible reading', { error: error.message });
  }
}

/**
 * Log successful OCR ingestion
 */
async function logOcrSuccess(data, vitalId) {
  try {
    await prisma.ocrLog.create({
      data: {
        patientId: data.patientId || null,
        cameraId: data.cameraId,
        confidence: data.confidence,
        inferenceTimeMs: data.inferenceTimeMs || 0,
        validationPassed: true,
        rawData: JSON.stringify({
          vitals: data.vitals,
          monitorType: data.monitorType,
          rawImagePath: data.rawImagePath,
          timestamp: data.timestamp,
          vitalId,
        }),
        screenDetected: true,
      },
    });
  } catch (error) {
    logger.error('Failed to log OCR success', { error: error.message });
  }
}

/**
 * Update camera statistics
 */
async function updateCameraStats(cameraId, confidence, inferenceTimeMs) {
  try {
    // Get recent logs for this camera
    const recentLogs = await prisma.ocrLog.findMany({
      where: {
        cameraId,
        processedAt: {
          gte: new Date(Date.now() - 3600000), // Last hour
        },
      },
      select: {
        confidence: true,
        inferenceTimeMs: true,
        validationPassed: true,
      },
    });

    // Update camera record with current inference
    const updateData = {
      lastInferenceAt: new Date(),
      status: 'active',
      totalInferences: { increment: 1 },
    };

    // If we have validation passed = true, otherwise increment failed
    if (recentLogs.length > 0 && !recentLogs[recentLogs.length - 1].validationPassed) {
      updateData.failedInferences = { increment: 1 };
    }

    // Calculate statistics if we have data
    if (recentLogs.length > 0) {
      const avgConfidence = recentLogs.reduce((sum, log) => sum + log.confidence, 0) / recentLogs.length;
      const successCount = recentLogs.filter((log) => log.validationPassed).length;
      const successRate = (successCount / recentLogs.length) * 100;

      updateData.avgConfidence = avgConfidence;
      updateData.successRate = successRate;
    }

    await prisma.camera.updateMany({
      where: { cameraId },
      data: updateData,
    });
  } catch (error) {
    logger.error('Failed to update camera stats', { cameraId, error: error.message });
  }
}

/**
 * Check vitals against alarm limits and trigger alarms
 */
async function checkAndTriggerAlarms(patientId, vitals, vitalId) {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { alarmLimits: true },
    });

    if (!patient || !patient.alarmLimits) return;

    const limits = JSON.parse(patient.alarmLimits);

    const alarms = [];

    // Check each vital against limits
    if (vitals.spo2 && limits.spo2) {
      const [min, max] = limits.spo2;
      if (vitals.spo2 < min) {
        alarms.push({
          type: 'critical',
          parameter: 'spo2',
          value: vitals.spo2,
          threshold: min,
          message: `SpO2 below limit (${vitals.spo2}% < ${min}%)`,
        });
      } else if (vitals.spo2 > max) {
        alarms.push({
          type: 'warning',
          parameter: 'spo2',
          value: vitals.spo2,
          threshold: max,
          message: `SpO2 above limit (${vitals.spo2}% > ${max}%)`,
        });
      }
    }

    if (vitals.hr && limits.pr) {
      const [min, max] = limits.pr;
      if (vitals.hr < min) {
        alarms.push({
          type: 'critical',
          parameter: 'pr',
          value: vitals.hr,
          threshold: min,
          message: `Heart rate below limit (${vitals.hr} < ${min} bpm)`,
        });
      } else if (vitals.hr > max) {
        alarms.push({
          type: 'warning',
          parameter: 'pr',
          value: vitals.hr,
          threshold: max,
          message: `Heart rate above limit (${vitals.hr} > ${max} bpm)`,
        });
      }
    }

    // Create alarm records
    for (const alarm of alarms) {
      await prisma.alarm.create({
        data: {
          patientId,
          type: alarm.type,
          parameter: alarm.parameter,
          value: alarm.value,
          threshold: alarm.threshold,
          message: alarm.message,
          status: 'active',
        },
      });

      logger.warn('Alarm triggered from OCR vitals', {
        patientId,
        vitalId,
        alarm,
      });
    }
  } catch (error) {
    logger.error('Failed to check alarms', { patientId, error: error.message });
  }
}

/**
 * Trigger manual entry alert for clinical staff
 */
async function triggerManualEntryAlert(patientId, cameraId, vitals, confidence) {
  try {
    // Find clinical staff assigned to this patient
    const staffUsers = await prisma.user.findMany({
      where: {
        role: { in: ['staff_nurse', 'charge_nurse', 'physician'] },
        active: true,
      },
    });

    // Create notification for each staff member
    for (const user of staffUsers) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Manual Vital Entry Required',
          message: `OCR confidence low (${(confidence * 100).toFixed(1)}%) for Patient ID ${patientId}. Please verify and enter vitals manually.`,
          type: 'warning',
          category: 'patient',
          priority: 'high',
          resourceType: 'patient',
          resourceId: patientId,
        },
      });
    }

    logger.info('Manual entry alert triggered', { patientId, cameraId, confidence });
  } catch (error) {
    logger.error('Failed to trigger manual entry alert', { error: error.message });
  }
}

/**
 * Trigger clinical review for implausible readings
 */
async function triggerClinicalReview(patientId, vitals, plausibilityCheck) {
  try {
    const physicians = await prisma.user.findMany({
      where: {
        role: { in: ['physician', 'charge_nurse'] },
        active: true,
      },
    });

    for (const physician of physicians) {
      await prisma.notification.create({
        data: {
          userId: physician.id,
          title: 'Clinical Review Required',
          message: `Implausible vital reading detected for Patient ID ${patientId}: ${plausibilityCheck.reason}`,
          type: 'alert',
          category: 'patient',
          priority: 'urgent',
          resourceType: 'patient',
          resourceId: patientId,
        },
      });
    }

    logger.warn('Clinical review triggered', { patientId, vitals, plausibilityCheck });
  } catch (error) {
    logger.error('Failed to trigger clinical review', { error: error.message });
  }
}
