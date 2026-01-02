import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';

// GET /api/care-plans/[patientId] - Get care plans for a specific patient
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { patientId } = await params;
  const patientIdNum = parseInt(patientId);

  if (isNaN(patientIdNum)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientIdNum },
    select: {
      id: true,
      mrn: true,
      name: true,
      gestationalAge: true,
      dayOfLife: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const includeItems = searchParams.get('includeItems') !== 'false';

  // Build query filters
  const where = { patientId: patientIdNum };

  if (status) {
    // Map lowercase to Prisma enum values
    const statusMap = {
      'active': 'ACTIVE',
      'on_hold': 'ON_HOLD',
      'completed': 'COMPLETED',
      'discontinued': 'DISCONTINUED',
      'archived': 'ARCHIVED',
    };
    const mappedStatus = statusMap[status.toLowerCase()];
    if (mappedStatus) {
      where.status = mappedStatus;
    }
  }

  if (category) {
    // Map lowercase to Prisma enum values
    const categoryMap = {
      'respiratory': 'RESPIRATORY',
      'nutrition': 'NUTRITION',
      'neuro': 'NEUROLOGICAL',
      'neurological': 'NEUROLOGICAL',
      'infection': 'INFECTION',
      'growth': 'GROWTH_DEVELOPMENT',
      'growth_development': 'GROWTH_DEVELOPMENT',
      'skin': 'SKIN_WOUND',
      'skin_wound': 'SKIN_WOUND',
      'family': 'FAMILY_SUPPORT',
      'family_support': 'FAMILY_SUPPORT',
      'pain': 'PAIN_MANAGEMENT',
      'pain_management': 'PAIN_MANAGEMENT',
      'developmental': 'DEVELOPMENTAL',
      'discharge': 'DISCHARGE_PLANNING',
      'discharge_planning': 'DISCHARGE_PLANNING',
      'other': 'OTHER',
    };
    const mappedCategory = categoryMap[category.toLowerCase()];
    if (mappedCategory) {
      where.category = mappedCategory;
    }
  }

  // Fetch care plans with items
  const carePlans = await prisma.carePlan.findMany({
    where,
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
          initials: true,
          role: true,
        },
      },
      items: includeItems ? {
        orderBy: { createdAt: 'asc' },
      } : false,
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  // Get item statistics for each care plan
  let itemStatsByPlan = {};
  if (includeItems && carePlans.length > 0) {
    const carePlanIds = carePlans.map(p => p.id);

    const statusCounts = await prisma.carePlanItem.groupBy({
      by: ['carePlanId', 'status'],
      where: {
        carePlanId: { in: carePlanIds },
      },
      _count: true,
    });

    for (const row of statusCounts) {
      if (!itemStatsByPlan[row.carePlanId]) {
        itemStatsByPlan[row.carePlanId] = {
          total: 0,
          pending: 0,
          in_progress: 0,
          completed: 0,
          skipped: 0,
        };
      }
      itemStatsByPlan[row.carePlanId][row.status] = row._count;
      itemStatsByPlan[row.carePlanId].total += row._count;
    }
  }

  // Transform care plans with computed progress
  const transformed = carePlans.map(plan => {
    const stats = itemStatsByPlan[plan.id] || { total: 0, completed: 0, skipped: 0 };
    const completedCount = stats.completed + stats.skipped;
    const progress = stats.total > 0 ? Math.round((completedCount / stats.total) * 100) : 0;

    return {
      ...plan,
      goals: plan.goals ? JSON.parse(plan.goals) : [],
      items: includeItems ? plan.items : undefined,
      itemStats: {
        total: stats.total,
        pending: stats.pending || 0,
        inProgress: stats.in_progress || 0,
        completed: stats.completed || 0,
        skipped: stats.skipped || 0,
      },
      progress,
    };
  });

  // Get summary by category
  const categorySummary = await prisma.carePlan.groupBy({
    by: ['category'],
    where: { patientId: patientIdNum, status: 'ACTIVE' },
    _count: true,
  });

  // Get summary by status
  const statusSummary = await prisma.carePlan.groupBy({
    by: ['status'],
    where: { patientId: patientIdNum },
    _count: true,
  });

  logger.info('Fetched patient care plans', {
    userId: session.user.id,
    patientId: patientIdNum,
    count: transformed.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    patient,
    meta: {
      total: transformed.length,
      categorySummary: categorySummary.reduce((acc, item) => {
        acc[item.category] = item._count;
        return acc;
      }, {}),
      statusSummary: statusSummary.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      timestamp: new Date().toISOString(),
    },
  });
});
