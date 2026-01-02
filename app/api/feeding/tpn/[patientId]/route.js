import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { z } from 'zod';

// Schema for TPN settings
const tpnSettingsSchema = z.object({
  rate: z.number().min(0, 'Rate cannot be negative').max(50, 'Rate exceeds maximum'),
  dextrose: z.number().min(5, 'Dextrose must be at least 5%').max(25, 'Dextrose exceeds maximum 25%'),
  aminoAcids: z.number().min(0, 'Amino acids cannot be negative').max(5, 'Amino acids exceed maximum 5 g/kg'),
  lipids: z.number().min(0, 'Lipids cannot be negative').max(4, 'Lipids exceed maximum 4 g/kg'),
  sodium: z.number().min(0, 'Sodium cannot be negative').max(10, 'Sodium exceeds maximum').optional(),
  potassium: z.number().min(0, 'Potassium cannot be negative').max(10, 'Potassium exceeds maximum').optional(),
  calcium: z.number().min(0, 'Calcium cannot be negative').max(10, 'Calcium exceeds maximum').optional(),
  phosphorus: z.number().min(0, 'Phosphorus cannot be negative').max(5, 'Phosphorus exceeds maximum').optional(),
  magnesium: z.number().min(0).max(2).optional(),
  acetate: z.number().min(0).max(50).optional(),
  chloride: z.number().min(0).max(50).optional(),
  // Trace elements and vitamins
  traceElements: z.boolean().optional(),
  mvitamins: z.boolean().optional(),
  // Additives
  heparin: z.number().min(0).max(2).optional(), // units/mL
  zinc: z.number().min(0).max(500).optional(), // mcg/kg
  selenium: z.number().min(0).max(5).optional(), // mcg/kg
  // Infusion details
  infusionHours: z.number().min(1).max(24).optional(),
  totalVolume: z.number().min(0).max(500).optional(),
  notes: z.string().max(500).optional().nullable(),
});

/**
 * GET /api/feeding/tpn/[patientId] - Get current TPN settings
 */
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // In Next.js 15, params is a Promise
  const resolvedParams = await params;
  const patientId = parseInt(resolvedParams.patientId, 10);
  if (isNaN(patientId) || patientId <= 0) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Fetch patient with current weight
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      currentWeight: true,
      dayOfLife: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Get TPN orders - in production, this would come from a TPN orders table
  // For now, calculate from recent flowsheet entries
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const flowsheetEntries = await prisma.flowsheetEntry.findMany({
    where: {
      patientId,
      shiftDate: { gte: todayStart },
      tpn: { gt: 0 },
    },
    orderBy: [{ shiftDate: 'desc' }, { hour: 'desc' }],
    take: 24,
  });

  // Calculate current TPN settings from flowsheet
  const tpnSettings = calculateTPNFromFlowsheet(flowsheetEntries, patient.currentWeight);

  // Get any active TPN/nutrition orders
  const activeTPNOrders = await prisma.order.findMany({
    where: {
      patientId,
      category: 'DIET',
      status: 'ACTIVE',
      name: { contains: 'TPN' },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  const activeOrder = activeTPNOrders[0];
  let orderDetails = null;

  if (activeOrder?.details) {
    try {
      orderDetails = JSON.parse(activeOrder.details);
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Merge order details with calculated settings
  const response = {
    ...tpnSettings,
    ...(orderDetails || {}),
    orderId: activeOrder?.id,
    orderName: activeOrder?.name,
    lastUpdated: activeOrder?.updatedAt?.toISOString() || new Date().toISOString(),
  };

  logger.info('TPN settings fetched', {
    userId: session.user.id,
    patientId,
    hasActiveOrder: !!activeOrder,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: response,
    meta: {
      patientId,
      patientName: patient.name,
      currentWeight: patient.currentWeight,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * PUT /api/feeding/tpn/[patientId] - Update TPN settings
 *
 * In a production system, this would create/update a TPN order
 * that would be verified by pharmacy before being administered.
 */
export const PUT = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Only physicians and charge nurses can modify TPN orders
  requireRole(session, ROLE_GROUPS.LEADERSHIP);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // In Next.js 15, params is a Promise
  const resolvedParams = await params;
  const patientId = parseInt(resolvedParams.patientId, 10);
  if (isNaN(patientId) || patientId <= 0) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validationResult = tpnSettingsSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))
    );
  }

  const tpnData = validationResult.data;

  // Fetch patient
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      currentWeight: true,
      gestationalAge: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Validate TPN parameters based on patient characteristics
  const validationWarnings = validateTPNParameters(tpnData, patient);

  // Calculate caloric content
  const caloricContent = calculateTPNCalories(tpnData, patient.currentWeight);

  // Deactivate any existing TPN orders
  await prisma.order.updateMany({
    where: {
      patientId,
      category: 'DIET',
      status: 'ACTIVE',
      name: { contains: 'TPN' },
    },
    data: {
      status: 'DISCONTINUED',
      discontinuedAt: new Date(),
      discontinuedById: parseInt(session.user.id),
      discontinueReason: 'Updated TPN order',
    },
  });

  // Create new TPN order
  const tpnOrder = await prisma.order.create({
    data: {
      patientId,
      orderingId: parseInt(session.user.id),
      category: 'DIET',
      orderType: 'CONTINUOUS',
      priority: 'ROUTINE',
      name: `TPN D${tpnData.dextrose}% AA${tpnData.aminoAcids}g/kg @ ${tpnData.rate}mL/hr`,
      details: JSON.stringify({
        ...tpnData,
        caloricContent,
        calculatedAt: new Date().toISOString(),
        patientWeight: patient.currentWeight,
      }),
      instructions: tpnData.notes || 'Infuse via central line. Verify with pharmacy before administration.',
      status: 'ACTIVE',
      startTime: new Date(),
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'update_tpn_order',
      resource: 'order',
      resourceId: tpnOrder.id,
      details: JSON.stringify({
        patientId,
        rate: tpnData.rate,
        dextrose: tpnData.dextrose,
        aminoAcids: tpnData.aminoAcids,
        lipids: tpnData.lipids,
        caloricContent,
      }),
    },
  });

  logger.audit('TPN order updated', {
    userId: session.user.id,
    patientId,
    orderId: tpnOrder.id,
    rate: tpnData.rate,
    dextrose: tpnData.dextrose,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      orderId: tpnOrder.id,
      ...tpnData,
      caloricContent,
    },
    meta: {
      message: 'TPN settings updated successfully',
      patientName: patient.name,
      warnings: validationWarnings,
      timestamp: new Date().toISOString(),
    },
  });
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate TPN settings from flowsheet entries
 */
function calculateTPNFromFlowsheet(entries, currentWeightKg) {
  const weightKg = currentWeightKg || 1;

  if (entries.length === 0) {
    // Return default TPN settings for new TPN
    return {
      rate: 0,
      dextrose: 10,
      aminoAcids: 2.5,
      lipids: 1.5,
      sodium: 3,
      potassium: 2,
      calcium: 2,
      phosphorus: 1.5,
      infusionHours: 24,
      isActive: false,
    };
  }

  // Calculate hourly rate from total volume
  const totalVolume = entries.reduce((sum, e) => sum + (e.tpn || 0), 0);
  const hoursRecorded = entries.length;
  const rate = Math.round((totalVolume / hoursRecorded) * 10) / 10;

  // These would typically come from pharmacy TPN composition
  return {
    rate,
    dextrose: 12.5, // Typical starting concentration
    aminoAcids: 3.5, // g/kg/day - typical
    lipids: 2.0, // g/kg/day
    sodium: 3, // mEq/kg/day
    potassium: 2,
    calcium: 2,
    phosphorus: 1.5,
    infusionHours: 24,
    totalVolume: Math.round(rate * 24),
    isActive: true,
    estimatedMlPerKgPerDay: Math.round((rate * 24) / weightKg),
  };
}

/**
 * Validate TPN parameters for safety
 */
function validateTPNParameters(tpnData, patient) {
  const warnings = [];
  const weightKg = patient.currentWeight || 1;

  // GIR (Glucose Infusion Rate) check
  // GIR = (Dextrose % x Rate mL/hr) / (Weight kg x 6)
  const gir = (tpnData.dextrose * tpnData.rate) / (weightKg * 6);

  if (gir > 12) {
    warnings.push({
      parameter: 'GIR',
      value: Math.round(gir * 10) / 10,
      message: 'GIR exceeds 12 mg/kg/min - risk of hyperglycemia',
      severity: 'high',
    });
  } else if (gir > 10) {
    warnings.push({
      parameter: 'GIR',
      value: Math.round(gir * 10) / 10,
      message: 'GIR is high (>10 mg/kg/min) - monitor glucose closely',
      severity: 'medium',
    });
  }

  // Protein check
  if (tpnData.aminoAcids > 4) {
    warnings.push({
      parameter: 'aminoAcids',
      value: tpnData.aminoAcids,
      message: 'Amino acid dose exceeds 4 g/kg/day - verify renal function',
      severity: 'medium',
    });
  }

  // Lipid check
  if (tpnData.lipids > 3.5) {
    warnings.push({
      parameter: 'lipids',
      value: tpnData.lipids,
      message: 'Lipid dose exceeds 3.5 g/kg/day - monitor triglycerides',
      severity: 'medium',
    });
  }

  // Calcium-phosphorus precipitation risk
  if (tpnData.calcium && tpnData.phosphorus) {
    const caPhosProduct = tpnData.calcium * tpnData.phosphorus;
    if (caPhosProduct > 10) {
      warnings.push({
        parameter: 'Ca-Phos',
        value: caPhosProduct,
        message: 'Calcium-phosphorus product >10 - precipitation risk',
        severity: 'high',
      });
    }
  }

  // Fluid volume check
  const totalFluidPerKg = (tpnData.rate * (tpnData.infusionHours || 24)) / weightKg;
  if (totalFluidPerKg > 180) {
    warnings.push({
      parameter: 'fluidVolume',
      value: Math.round(totalFluidPerKg),
      message: 'Total fluid exceeds 180 mL/kg/day - verify fluid tolerance',
      severity: 'medium',
    });
  }

  return warnings;
}

/**
 * Calculate caloric content of TPN
 */
function calculateTPNCalories(tpnData, currentWeightKg) {
  const weightKg = currentWeightKg || 1;
  const dailyVolume = tpnData.rate * (tpnData.infusionHours || 24);

  // Dextrose: 3.4 kcal/g
  // 1mL of D10% = 0.1g dextrose = 0.34 kcal
  const dextroseGrams = dailyVolume * (tpnData.dextrose / 100);
  const caloriesFromDextrose = dextroseGrams * 3.4;

  // Amino acids: 4 kcal/g (though not typically counted for growth)
  const aminoAcidGrams = tpnData.aminoAcids * weightKg;
  const caloriesFromAminoAcids = aminoAcidGrams * 4;

  // Lipids: 9 kcal/g (10% lipid emulsion = 1.1 kcal/mL)
  const lipidGrams = tpnData.lipids * weightKg;
  const caloriesFromLipids = lipidGrams * 9;

  const totalCalories = caloriesFromDextrose + caloriesFromLipids;
  const caloriesWithProtein = totalCalories + caloriesFromAminoAcids;

  return {
    fromDextrose: Math.round(caloriesFromDextrose),
    fromLipids: Math.round(caloriesFromLipids),
    fromAminoAcids: Math.round(caloriesFromAminoAcids),
    totalNonProtein: Math.round(totalCalories),
    totalWithProtein: Math.round(caloriesWithProtein),
    perKg: Math.round(totalCalories / weightKg),
    perKgWithProtein: Math.round(caloriesWithProtein / weightKg),
  };
}
