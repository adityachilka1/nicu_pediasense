import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';
import { z } from 'zod';

// Query params schema
const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

/**
 * GET /api/feeding/[patientId] - Get feeding summary and logs for a patient
 *
 * Returns comprehensive feeding data including:
 * - 24h summary with calorie calculations
 * - Feed logs
 * - TPN settings
 * - Breast milk inventory
 * - NEC risk factors
 */
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const patientId = parseInt(params.patientId, 10);
  if (isNaN(patientId) || patientId <= 0) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const queryResult = querySchema.safeParse({
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    limit: searchParams.get('limit'),
  });

  if (!queryResult.success) {
    throw new ValidationError(
      queryResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))
    );
  }

  const { startDate, endDate, limit } = queryResult.data;

  // Fetch patient with weight for calculations
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      currentWeight: true,
      birthWeight: true,
      gestationalAge: true,
      dayOfLife: true,
      status: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Calculate time ranges
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Build where clause for feeding logs
  const feedingWhere = {
    patientId,
    recordedAt: {
      gte: startDate ? new Date(startDate) : last24Hours,
      ...(endDate && { lte: new Date(endDate) }),
    },
  };

  // Fetch feeding logs, TPN data, and flowsheet data in parallel
  const [feedingLogs, flowsheetEntries, recentTransfusion] = await Promise.all([
    prisma.feedingLog.findMany({
      where: feedingWhere,
      orderBy: { recordedAt: 'desc' },
      take: limit ? Math.min(limit, 200) : 100,
    }),
    // Get today's flowsheet for TPN/IV data
    prisma.flowsheetEntry.findMany({
      where: {
        patientId,
        shiftDate: {
          gte: todayStart,
        },
      },
      orderBy: [{ shiftDate: 'desc' }, { hour: 'desc' }],
    }),
    // Check for recent blood transfusion (for NEC risk)
    prisma.flowsheetEntry.findFirst({
      where: {
        patientId,
        bloodProducts: { gt: 0 },
        shiftDate: {
          gte: new Date(now.getTime() - 48 * 60 * 60 * 1000), // Last 48h
        },
      },
    }),
  ]);

  // Calculate feeding summary for last 24 hours
  const summary = calculateFeedingSummary(
    feedingLogs.filter(f => new Date(f.recordedAt) >= last24Hours),
    flowsheetEntries,
    patient.currentWeight
  );

  // Extract TPN settings from most recent flowsheet entries
  const tpn = extractTPNSettings(flowsheetEntries, patient.currentWeight);

  // Calculate breast milk inventory (from recent feeding logs)
  const breastMilk = calculateBreastMilkInventory(feedingLogs);

  // Calculate NEC risk factors data
  const necRiskData = {
    hasRecentTransfusion: !!recentTransfusion,
    hasFeedingIntolerance: feedingLogs.some(f => f.tolerance === 'poor' || f.emesis),
    recentResiduals: feedingLogs.filter(f => f.volumeResidual && f.volumeResidual > 0).length,
    milkType: determinePrimaryMilkType(feedingLogs),
    advancementRate: calculateAdvancementRate(feedingLogs, patient.currentWeight),
  };

  // Transform feed logs for response
  const transformedLogs = feedingLogs.map(f => ({
    id: f.id,
    time: new Date(f.recordedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    type: mapFeedingTypeToDisplay(f.feedingType),
    amount: f.volumeGiven || 0,
    method: mapRouteToDisplay(f.route),
    milk: mapMilkTypeToDisplay(f.feedingType, f.fortified),
    tolerated: f.tolerance !== 'poor' && !f.emesis,
    note: f.notes || (f.volumeResidual ? `Residual ${f.volumeResidual}mL` : undefined),
    residual: f.volumeResidual,
    residualColor: f.residualColor,
    tolerance: f.tolerance,
    emesis: f.emesis,
    emesisAmount: f.emesisAmount,
    recordedBy: f.recordedBy,
    recordedAt: f.recordedAt.toISOString(),
  }));

  logger.info('Feeding data fetched', {
    userId: session.user.id,
    patientId,
    logCount: transformedLogs.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      summary,
      feedLog: transformedLogs,
      tpn,
      breastMilk,
      necRiskData,
    },
    meta: {
      patientId,
      patientName: patient.name,
      mrn: patient.mrn,
      currentWeight: patient.currentWeight,
      birthWeight: patient.birthWeight,
      gestationalAge: patient.gestationalAge,
      dayOfLife: patient.dayOfLife,
      timestamp: new Date().toISOString(),
    },
  });
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate comprehensive feeding summary with calorie calculations
 */
function calculateFeedingSummary(feedingLogs, flowsheetEntries, currentWeightKg) {
  const weightKg = currentWeightKg || 1; // Default to 1kg to avoid division by zero

  // Sum up enteral intake from feeding logs
  let totalEnteralVolume = 0;
  let totalCaloriesEnteral = 0;

  for (const log of feedingLogs) {
    const volume = log.volumeGiven || 0;
    totalEnteralVolume += volume;

    // Calculate calories based on milk type and fortification
    // Standard: EBM ~20 kcal/oz, Fortified ~24 kcal/oz, Formula ~20-24 kcal/oz
    const caloriesPerMl = getCaloriesPerMl(log.feedingType, log.fortified, log.calories);
    totalCaloriesEnteral += volume * caloriesPerMl;
  }

  // Sum up parenteral intake from flowsheet
  let totalTPNVolume = 0;
  let totalLipidsVolume = 0;
  let totalIVVolume = 0;
  let totalDextroseGrams = 0;
  let totalAminoAcidsGrams = 0;

  for (const entry of flowsheetEntries) {
    totalTPNVolume += entry.tpn || 0;
    totalLipidsVolume += entry.lipids || 0;
    totalIVVolume += entry.ivFluids || 0;

    // Estimate dextrose and amino acids from TPN (typical concentrations)
    // These would ideally come from TPN order details
    if (entry.tpn) {
      // Assume D12.5% TPN with 3g/kg amino acids as typical
      totalDextroseGrams += (entry.tpn * 0.125); // 12.5% dextrose
      totalAminoAcidsGrams += (entry.tpn * 0.03); // ~3% amino acids
    }
  }

  const totalParenteralVolume = totalTPNVolume + totalLipidsVolume + totalIVVolume;

  // Calculate parenteral calories
  // Dextrose: 3.4 kcal/g, Lipids: 9 kcal/g (10% lipids = 1.1 kcal/mL)
  const caloriesFromDextrose = totalDextroseGrams * 3.4;
  const caloriesFromLipids = totalLipidsVolume * 1.1;
  const caloriesFromAminoAcids = totalAminoAcidsGrams * 4; // 4 kcal/g protein
  const totalCaloriesParenteral = caloriesFromDextrose + caloriesFromLipids + caloriesFromAminoAcids;

  const totalIntake = totalEnteralVolume + totalParenteralVolume;
  const totalCalories = totalCaloriesEnteral + totalCaloriesParenteral;

  // Calculate per kg values
  const enteralIntakePerKg = Math.round((totalEnteralVolume / weightKg) * 10) / 10;
  const parenteralIntakePerKg = Math.round((totalParenteralVolume / weightKg) * 10) / 10;
  const totalIntakePerKg = Math.round((totalIntake / weightKg) * 10) / 10;
  const caloriesPerKg = Math.round((totalCalories / weightKg) * 10) / 10;

  // Calculate protein intake (g/kg/day)
  const proteinFromEnteral = totalEnteralVolume * 0.011; // ~1.1g/100mL for fortified breast milk
  const proteinTotal = proteinFromEnteral + totalAminoAcidsGrams;
  const proteinPerKg = Math.round((proteinTotal / weightKg) * 10) / 10;

  // Calculate GIR (Glucose Infusion Rate) - mg/kg/min
  // GIR = (Dextrose concentration % x Rate mL/hr) / (Weight kg x 6)
  // Using hourly rate approximation from 24h data
  const hoursOfData = Math.max(1, (Date.now() - Math.min(...feedingLogs.map(f => new Date(f.recordedAt).getTime()))) / (1000 * 60 * 60));
  const hourlyTPNRate = totalTPNVolume / hoursOfData;
  const dextroseConcentration = 12.5; // Assume D12.5%
  const gir = Math.round(((dextroseConcentration * hourlyTPNRate) / (weightKg * 6)) * 10) / 10;

  return {
    totalIntake: totalIntakePerKg,
    enteralIntake: enteralIntakePerKg,
    parenteralIntake: parenteralIntakePerKg,
    totalCalories: Math.round(totalCalories),
    caloriesPerKg,
    proteinGPerKg: proteinPerKg,
    gir: Math.max(0, gir) || 0,
    fluidTarget: 150, // Default target, could be from orders
    calorieTarget: 120, // Default target for preterm
    // Absolute values
    totalEnteralVolume: Math.round(totalEnteralVolume),
    totalParenteralVolume: Math.round(totalParenteralVolume),
    feedingsToday: feedingLogs.length,
    toleratedCount: feedingLogs.filter(f => f.tolerance !== 'poor' && !f.emesis).length,
    residualCount: feedingLogs.filter(f => f.volumeResidual && f.volumeResidual > 0).length,
  };
}

/**
 * Get calories per mL based on feeding type
 */
function getCaloriesPerMl(feedingType, fortified, specifiedCalories) {
  if (specifiedCalories) {
    // Convert kcal/oz to kcal/mL (1 oz = ~30mL)
    return specifiedCalories / 30;
  }

  // Default calorie densities
  switch (feedingType) {
    case 'breast':
      return fortified ? 0.8 : 0.67; // 24 kcal/oz vs 20 kcal/oz
    case 'fortified':
      return 0.8; // 24 kcal/oz
    case 'formula':
      return 0.67; // 20 kcal/oz (standard)
    case 'enteral':
      return fortified ? 0.8 : 0.67;
    default:
      return 0.67;
  }
}

/**
 * Extract TPN settings from flowsheet entries
 */
function extractTPNSettings(flowsheetEntries, currentWeightKg) {
  const weightKg = currentWeightKg || 1;

  // Sum up today's TPN data
  const totalTPN = flowsheetEntries.reduce((sum, e) => sum + (e.tpn || 0), 0);
  const totalLipids = flowsheetEntries.reduce((sum, e) => sum + (e.lipids || 0), 0);

  // Calculate hourly rate
  const hoursRecorded = flowsheetEntries.length || 1;
  const hourlyRate = Math.round((totalTPN / hoursRecorded) * 10) / 10;

  // Typical TPN composition estimates (would come from pharmacy orders in production)
  return {
    rate: hourlyRate,
    dextrose: 12.5, // %
    aminoAcids: Math.round((3.5 / weightKg) * 10) / 10, // g/kg - typical starting dose
    lipids: Math.round((totalLipids / (weightKg * hoursRecorded)) * 24 * 10) / 10, // g/kg/day
    sodium: 3, // mEq/kg - typical
    potassium: 2, // mEq/kg
    calcium: 2, // mEq/kg
    phosphorus: 1.5, // mmol/kg
    totalVolume: totalTPN,
    hoursRecorded,
  };
}

/**
 * Calculate breast milk inventory from feeding logs
 */
function calculateBreastMilkInventory(feedingLogs) {
  const breastMilkFeeds = feedingLogs.filter(f =>
    f.feedingType === 'breast' || f.feedingType === 'fortified'
  );

  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentBreastMilkFeeds = breastMilkFeeds.filter(f =>
    new Date(f.recordedAt) >= last7Days
  );

  const totalBreastMilkUsed = recentBreastMilkFeeds.reduce((sum, f) => sum + (f.volumeGiven || 0), 0);
  const avgDailyUsage = totalBreastMilkUsed / 7;

  // Find most recent breast milk feed
  const lastBreastMilkFeed = breastMilkFeeds[0];

  // These would typically come from a separate breast milk inventory table
  // For now, estimate based on usage patterns
  return {
    motherSupply: breastMilkFeeds.length > 0 ? 85 : 0, // % - would come from lactation tracking
    stored: Math.round(avgDailyUsage * 3), // Estimate 3 days supply
    lastPump: lastBreastMilkFeed
      ? new Date(lastBreastMilkFeed.recordedAt).toISOString()
      : null,
    avgVolume: Math.round(avgDailyUsage / 8) || 0, // Per pump session (8/day)
    totalUsedLast7Days: Math.round(totalBreastMilkUsed),
    feedCount: breastMilkFeeds.length,
  };
}

/**
 * Determine primary milk type from feeding logs
 */
function determinePrimaryMilkType(feedingLogs) {
  const typeCounts = {};
  for (const log of feedingLogs) {
    const type = log.feedingType;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  const maxType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (!maxType) return 'EBM';

  switch (maxType[0]) {
    case 'formula': return 'Formula';
    case 'breast': return 'EBM';
    case 'fortified': return 'EBM';
    default: return 'EBM';
  }
}

/**
 * Calculate feed advancement rate (mL/kg/day increase)
 */
function calculateAdvancementRate(feedingLogs, currentWeightKg) {
  if (feedingLogs.length < 2 || !currentWeightKg) return 0;

  const sortedLogs = [...feedingLogs].sort((a, b) =>
    new Date(a.recordedAt) - new Date(b.recordedAt)
  );

  // Compare first and last day's total volumes
  const firstDay = sortedLogs[0];
  const lastDay = sortedLogs[sortedLogs.length - 1];

  const daysDiff = (new Date(lastDay.recordedAt) - new Date(firstDay.recordedAt)) / (1000 * 60 * 60 * 24);
  if (daysDiff < 1) return 0;

  // This is a simplified calculation - in production, track daily totals
  const volumeDiff = (lastDay.volumeGiven || 0) - (firstDay.volumeGiven || 0);
  const ratePerDay = (volumeDiff / daysDiff) * 8; // Assume 8 feeds/day

  return Math.round((ratePerDay / currentWeightKg) * 10) / 10;
}

// Mapping functions for display
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

function mapMilkTypeToDisplay(feedingType, fortified) {
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
