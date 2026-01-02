import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';

// GET /api/family/education - Get education materials
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const contentType = searchParams.get('contentType');
  const gestationalAge = searchParams.get('gestationalAge');
  const dayOfLife = searchParams.get('dayOfLife');
  const familyContactId = searchParams.get('familyContactId');

  // Parse pagination
  const { limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 50,
    maxLimit: 100,
  });

  // Build query filters
  const where = {
    active: true,
  };

  if (category) {
    where.category = category;
  }

  if (contentType) {
    where.contentType = contentType;
  }

  // Filter by gestational age if provided
  if (gestationalAge) {
    const gaWeeks = parseInt(gestationalAge);
    if (!isNaN(gaWeeks)) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { gestationalAgeMin: null },
          { gestationalAgeMin: { lte: gaWeeks } },
        ],
      });
      where.AND.push({
        OR: [
          { gestationalAgeMax: null },
          { gestationalAgeMax: { gte: gaWeeks } },
        ],
      });
    }
  }

  // Filter by day of life if provided
  if (dayOfLife) {
    const dol = parseInt(dayOfLife);
    if (!isNaN(dol)) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { dayOfLifeMin: null },
          { dayOfLifeMin: { lte: dol } },
        ],
      });
      where.AND.push({
        OR: [
          { dayOfLifeMax: null },
          { dayOfLifeMax: { gte: dol } },
        ],
      });
    }
  }

  // Execute query
  const [materials, total] = await Promise.all([
    prisma.educationMaterial.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { title: 'asc' },
      ],
      skip: offset,
      take: limit,
    }),
    prisma.educationMaterial.count({ where }),
  ]);

  // If familyContactId is provided, include progress information
  let progressMap = {};
  if (familyContactId) {
    const progress = await prisma.educationProgress.findMany({
      where: {
        familyContactId: parseInt(familyContactId),
        materialId: { in: materials.map(m => m.id) },
      },
    });

    progressMap = progress.reduce((acc, p) => {
      acc[p.materialId] = {
        status: p.status,
        startedAt: p.startedAt,
        completedAt: p.completedAt,
        timeSpentSeconds: p.timeSpentSeconds,
        quizScore: p.quizScore,
      };
      return acc;
    }, {});
  }

  // Get categories for filter
  const categories = await prisma.educationMaterial.groupBy({
    by: ['category'],
    where: { active: true },
    _count: true,
  });

  // Get content types for filter
  const contentTypes = await prisma.educationMaterial.groupBy({
    by: ['contentType'],
    where: { active: true },
    _count: true,
  });

  logger.info('Fetched education materials', {
    userId: session.user.id,
    category,
    contentType,
    materialCount: materials.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json(
    createPaginatedResponse({
      data: materials.map(m => ({
        ...m,
        progress: progressMap[m.id] || null,
        completed: progressMap[m.id]?.status === 'completed',
      })),
      total,
      limit,
      offset,
      additionalMeta: {
        categories: categories.map(c => ({
          name: c.category,
          count: c._count,
        })),
        contentTypes: contentTypes.map(ct => ({
          name: ct.contentType,
          count: ct._count,
        })),
        filters: {
          category,
          contentType,
          gestationalAge,
          dayOfLife,
        },
      },
    })
  );
});
