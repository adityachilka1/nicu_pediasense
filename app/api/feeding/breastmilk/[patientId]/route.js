import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';
import { z } from 'zod';

// Query schema
const querySchema = z.object({
  days: z.string().regex(/^\d+$/).transform(Number).optional(),
});

/**
 * GET /api/feeding/breastmilk/[patientId] - Get breast milk inventory and stats
 *
 * Returns:
 * - Current inventory (stored milk volumes by date)
 * - Usage statistics
 * - Pump session history
 * - Supply trends
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

  // Parse query params
  const { searchParams } = new URL(request.url);
  const queryResult = querySchema.safeParse({
    days: searchParams.get('days') || '7',
  });

  const days = queryResult.success ? queryResult.data.days || 7 : 7;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Fetch patient
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

  // Fetch breast milk feeding logs
  const breastMilkLogs = await prisma.feedingLog.findMany({
    where: {
      patientId,
      feedingType: { in: ['BREAST_MILK', 'FORTIFIED_BREAST_MILK', 'DONOR_MILK'] },
      recordedAt: { gte: startDate },
    },
    orderBy: { recordedAt: 'desc' },
  });

  // Calculate daily usage
  const dailyUsage = calculateDailyUsage(breastMilkLogs);

  // Calculate inventory (in a production system, this would be from a dedicated inventory table)
  const inventory = calculateBreastMilkInventory(breastMilkLogs, dailyUsage);

  // Get pump session data (from family contacts or dedicated pump log)
  // For now, estimate from feeding patterns
  const pumpSessions = estimatePumpSessions(breastMilkLogs, dailyUsage);

  // Calculate supply adequacy
  const supplyStats = calculateSupplyStats(dailyUsage, patient.currentWeight);

  logger.info('Breast milk data fetched', {
    userId: session.user.id,
    patientId,
    feedCount: breastMilkLogs.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      inventory,
      dailyUsage,
      pumpSessions,
      supplyStats,
      recentFeedings: breastMilkLogs.slice(0, 10).map(f => ({
        id: f.id,
        time: f.recordedAt.toISOString(),
        volume: f.volumeGiven,
        type: f.fortified ? 'Fortified' : 'EBM',
        route: f.route,
      })),
    },
    meta: {
      patientId,
      patientName: patient.name,
      currentWeight: patient.currentWeight,
      daysAnalyzed: days,
      timestamp: new Date().toISOString(),
    },
  });
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate daily breast milk usage
 */
function calculateDailyUsage(feedingLogs) {
  const dailyTotals = {};

  for (const log of feedingLogs) {
    const dateKey = new Date(log.recordedAt).toISOString().split('T')[0];

    if (!dailyTotals[dateKey]) {
      dailyTotals[dateKey] = {
        date: dateKey,
        totalVolume: 0,
        feedCount: 0,
        fortifiedCount: 0,
        ebmCount: 0,
      };
    }

    dailyTotals[dateKey].totalVolume += log.volumeGiven || 0;
    dailyTotals[dateKey].feedCount += 1;

    if (log.fortified || log.feedingType === 'fortified') {
      dailyTotals[dateKey].fortifiedCount += 1;
    } else {
      dailyTotals[dateKey].ebmCount += 1;
    }
  }

  // Convert to sorted array
  return Object.values(dailyTotals)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(d => ({
      ...d,
      totalVolume: Math.round(d.totalVolume),
      avgPerFeed: d.feedCount > 0 ? Math.round(d.totalVolume / d.feedCount) : 0,
    }));
}

/**
 * Calculate estimated inventory based on usage patterns
 *
 * In production, this would query a dedicated BreastMilkInventory table
 * that tracks received milk, storage location, expiration dates, etc.
 */
function calculateBreastMilkInventory(feedingLogs, dailyUsage) {
  // Calculate average daily usage
  const totalUsed = dailyUsage.reduce((sum, d) => sum + d.totalVolume, 0);
  const avgDailyUsage = dailyUsage.length > 0 ? totalUsed / dailyUsage.length : 0;

  // Get most recent feeding
  const lastFeed = feedingLogs[0];
  const lastFeedTime = lastFeed ? new Date(lastFeed.recordedAt) : null;

  // Estimate current inventory (would come from actual inventory tracking)
  // Assume mother provides ~3 days worth on average
  const estimatedInventory = Math.round(avgDailyUsage * 3);

  // Calculate days supply remaining
  const daysSupply = avgDailyUsage > 0 ? Math.round(estimatedInventory / avgDailyUsage) : 0;

  return {
    currentVolume: estimatedInventory,
    avgDailyUsage: Math.round(avgDailyUsage),
    daysSupply,
    lastReceived: lastFeedTime ? lastFeedTime.toISOString() : null,
    // Inventory breakdown (simulated)
    frozen: Math.round(estimatedInventory * 0.7),
    refrigerated: Math.round(estimatedInventory * 0.3),
    // Alerts
    lowInventoryAlert: daysSupply < 2,
    expiringAlert: false, // Would check expiration dates in real system
    // Storage details (simulated)
    storageLocations: [
      { location: 'Patient Freezer', volume: Math.round(estimatedInventory * 0.5) },
      { location: 'Unit Freezer', volume: Math.round(estimatedInventory * 0.2) },
      { location: 'Refrigerator', volume: Math.round(estimatedInventory * 0.3) },
    ],
  };
}

/**
 * Estimate pump sessions from feeding patterns
 *
 * In production, this would query a PumpSession table with actual pump logs
 */
function estimatePumpSessions(feedingLogs, dailyUsage) {
  const recentUsage = dailyUsage.slice(0, 3);
  const avgDailyVolume = recentUsage.length > 0
    ? recentUsage.reduce((sum, d) => sum + d.totalVolume, 0) / recentUsage.length
    : 0;

  // Assume 8 pump sessions per day with equal distribution
  const avgVolumePerSession = avgDailyVolume > 0 ? Math.round(avgDailyVolume / 8) : 0;

  // Get most recent breast milk feed time as proxy for last pump
  const lastBreastMilkFeed = feedingLogs[0];

  return {
    avgSessionsPerDay: 8, // Typical goal
    avgVolumePerSession,
    lastSession: lastBreastMilkFeed
      ? new Date(new Date(lastBreastMilkFeed.recordedAt).getTime() - 3 * 60 * 60 * 1000).toISOString()
      : null,
    totalTodayVolume: dailyUsage[0]?.totalVolume || 0,
    // Goals and tracking (would be customized per mother)
    dailyGoal: 400, // mL - typical goal for preterm mother
    goalProgress: dailyUsage[0] ? Math.round((dailyUsage[0].totalVolume / 400) * 100) : 0,
  };
}

/**
 * Calculate supply adequacy statistics
 */
function calculateSupplyStats(dailyUsage, currentWeightKg) {
  const weightKg = currentWeightKg || 1;

  // Last 7 days of data
  const recentDays = dailyUsage.slice(0, 7);

  if (recentDays.length === 0) {
    return {
      motherSupplyPercent: 0,
      trend: 'unknown',
      avgMlPerKgPerDay: 0,
      supplyStatus: 'No data',
      recommendations: ['Begin tracking breast milk supply'],
    };
  }

  // Calculate average and trend
  const avgDailyVolume = recentDays.reduce((sum, d) => sum + d.totalVolume, 0) / recentDays.length;

  // Calculate mL/kg/day
  const mlPerKgPerDay = Math.round(avgDailyVolume / weightKg);

  // Target: 150-180 mL/kg/day for full enteral feeds
  // Mother supply calculated as percentage of target
  const targetVolume = 160 * weightKg;
  const motherSupplyPercent = Math.min(100, Math.round((avgDailyVolume / targetVolume) * 100));

  // Calculate trend (comparing first half to second half)
  let trend = 'stable';
  if (recentDays.length >= 4) {
    const firstHalf = recentDays.slice(Math.floor(recentDays.length / 2));
    const secondHalf = recentDays.slice(0, Math.floor(recentDays.length / 2));

    const firstAvg = firstHalf.reduce((sum, d) => sum + d.totalVolume, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.totalVolume, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) trend = 'increasing';
    else if (change < -10) trend = 'decreasing';
  }

  // Determine supply status and recommendations
  let supplyStatus, recommendations;

  if (motherSupplyPercent >= 100) {
    supplyStatus = 'Full supply';
    recommendations = [
      'Excellent supply - maintain current pumping frequency',
      'Consider donating excess milk to milk bank',
    ];
  } else if (motherSupplyPercent >= 75) {
    supplyStatus = 'Good supply';
    recommendations = [
      'Good progress - continue current regimen',
      'Consider power pumping to boost supply',
    ];
  } else if (motherSupplyPercent >= 50) {
    supplyStatus = 'Partial supply';
    recommendations = [
      'Supplement with donor milk or formula as needed',
      'Increase pumping frequency',
      'Consider lactation consultation',
    ];
  } else {
    supplyStatus = 'Low supply';
    recommendations = [
      'Request lactation consultant assessment',
      'Increase skin-to-skin time',
      'Consider galactagogues with provider approval',
      'Donor milk supplementation recommended',
    ];
  }

  return {
    motherSupplyPercent,
    trend,
    avgMlPerKgPerDay: mlPerKgPerDay,
    supplyStatus,
    recommendations,
    // Additional metrics
    avgDailyVolume: Math.round(avgDailyVolume),
    targetDailyVolume: Math.round(targetVolume),
    daysTracked: recentDays.length,
  };
}
