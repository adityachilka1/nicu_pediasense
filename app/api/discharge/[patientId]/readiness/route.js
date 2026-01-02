import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';

// Map lowercase status input to uppercase Prisma enum
function mapChecklistStatusToEnum(status) {
  const statusMap = {
    pending: 'PENDING',
    in_progress: 'IN_PROGRESS',
    completed: 'COMPLETED',
    not_applicable: 'NOT_APPLICABLE',
    deferred: 'DEFERRED',
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    DEFERRED: 'DEFERRED',
  };
  return statusMap[status] || status?.toUpperCase();
}

// GET /api/discharge/[patientId]/readiness - Calculate discharge readiness
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  // In Next.js 15, params is a Promise
  const resolvedParams = await params;
  const patientId = parseInt(resolvedParams.patientId);
  if (isNaN(patientId)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      mrn: true,
      gestationalAge: true,
      dayOfLife: true,
      status: true,
      admitDate: true,
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Get discharge plan with checklist items
  const dischargePlan = await prisma.dischargePlan.findUnique({
    where: { patientId },
    include: {
      checklistItems: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!dischargePlan) {
    return NextResponse.json({
      data: {
        patientId,
        readinessScore: 0,
        status: 'not_started',
        message: 'No discharge plan created yet',
        categories: {},
        blockers: [],
        pendingItems: [],
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  const { checklistItems } = dischargePlan;

  // Calculate overall readiness
  const applicableItems = checklistItems.filter(item => item.status !== 'NOT_APPLICABLE');
  const requiredItems = applicableItems.filter(item => item.required);
  const completedRequired = requiredItems.filter(item => item.status === 'COMPLETED');
  const completedAll = applicableItems.filter(item => item.status === 'COMPLETED');

  const readinessScore = requiredItems.length > 0
    ? Math.round((completedRequired.length / requiredItems.length) * 100)
    : 0;

  // Group items by category and calculate progress
  const categories = {};
  checklistItems.forEach(item => {
    if (!categories[item.category]) {
      categories[item.category] = {
        total: 0,
        applicable: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        notApplicable: 0,
        required: 0,
        requiredCompleted: 0,
        items: [],
      };
    }

    const cat = categories[item.category];
    cat.total++;
    cat.items.push({
      id: item.id,
      description: item.description,
      status: item.status,
      required: item.required,
      completedAt: item.completedAt,
    });

    if (item.status === 'NOT_APPLICABLE') {
      cat.notApplicable++;
    } else {
      cat.applicable++;
      if (item.required) {
        cat.required++;
        if (item.status === 'COMPLETED') {
          cat.requiredCompleted++;
        }
      }

      switch (item.status) {
        case 'COMPLETED':
          cat.completed++;
          break;
        case 'IN_PROGRESS':
          cat.inProgress++;
          break;
        case 'PENDING':
          cat.pending++;
          break;
      }
    }
  });

  // Calculate category progress percentages
  Object.keys(categories).forEach(catKey => {
    const cat = categories[catKey];
    cat.progress = cat.applicable > 0 ? Math.round((cat.completed / cat.applicable) * 100) : 0;
    cat.requiredProgress = cat.required > 0 ? Math.round((cat.requiredCompleted / cat.required) * 100) : 100;
  });

  // Identify blockers (required items not completed)
  const blockers = checklistItems
    .filter(item => item.required && item.status !== 'COMPLETED' && item.status !== 'NOT_APPLICABLE')
    .map(item => ({
      id: item.id,
      category: item.category,
      description: item.description,
      status: item.status,
    }));

  // Identify pending items (all items not completed)
  const pendingItems = checklistItems
    .filter(item => item.status === 'PENDING' || item.status === 'IN_PROGRESS')
    .map(item => ({
      id: item.id,
      category: item.category,
      description: item.description,
      status: item.status,
      required: item.required,
    }));

  // Determine overall status
  let overallStatus = 'planning';
  if (readinessScore === 100) {
    overallStatus = 'ready';
  } else if (readinessScore >= 75) {
    overallStatus = 'almost_ready';
  } else if (readinessScore >= 50) {
    overallStatus = 'in_progress';
  }

  // Estimated time to discharge based on pending items
  let estimatedDaysToReady = null;
  if (blockers.length > 0) {
    // Rough estimate: 1-2 days per blocker on average
    estimatedDaysToReady = Math.ceil(blockers.length * 1.5);
  } else if (readinessScore === 100) {
    estimatedDaysToReady = 0;
  }

  logger.info('Calculated discharge readiness', {
    userId: session.user.id,
    patientId,
    readinessScore,
    blockers: blockers.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      patientId,
      patientName: patient.name,
      dischargePlanId: dischargePlan.id,
      dischargePlanStatus: dischargePlan.status,
      estimatedDischargeDate: dischargePlan.estimatedDate,
      readinessScore,
      overallStatus,
      estimatedDaysToReady,
      summary: {
        totalItems: checklistItems.length,
        applicableItems: applicableItems.length,
        completedItems: completedAll.length,
        requiredItems: requiredItems.length,
        completedRequired: completedRequired.length,
        pendingCount: pendingItems.length,
        blockerCount: blockers.length,
      },
      categories,
      blockers,
      pendingItems,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});
