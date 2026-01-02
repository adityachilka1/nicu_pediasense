import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';

// GET /api/orders/sets - Get all order set templates
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const activeOnly = searchParams.get('activeOnly') !== 'false';

  // Build query filters
  const where = {};

  if (activeOnly) {
    where.active = true;
  }

  if (category) {
    const validCategories = ['admission', 'respiratory', 'nutrition', 'infection', 'discharge', 'sepsis', 'hyperbilirubinemia', 'hypoglycemia'];
    if (validCategories.includes(category)) {
      where.category = category;
    }
  }

  const orderSets = await prisma.orderSet.findMany({
    where,
    orderBy: [
      { category: 'asc' },
      { name: 'asc' },
    ],
  });

  // Transform to parse JSON items
  const transformed = orderSets.map(set => ({
    ...set,
    items: set.items ? JSON.parse(set.items) : [],
    itemCount: set.items ? JSON.parse(set.items).length : 0,
  }));

  // Group by category for easier frontend consumption
  const byCategory = transformed.reduce((acc, set) => {
    if (!acc[set.category]) {
      acc[set.category] = [];
    }
    acc[set.category].push(set);
    return acc;
  }, {});

  logger.info('Fetched order sets', {
    userId: session.user.id,
    count: transformed.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    meta: {
      total: transformed.length,
      byCategory,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/orders/sets - Create a new order set template
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Only admin and physicians can create order sets
  requireRole(session, ['admin', 'physician']);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const { name, description, category, items } = body;

  // Validation
  if (!name || name.trim().length === 0) {
    throw new ValidationError([{ field: 'name', message: 'Name is required' }]);
  }

  if (!category) {
    throw new ValidationError([{ field: 'category', message: 'Category is required' }]);
  }

  const validCategories = ['admission', 'respiratory', 'nutrition', 'infection', 'discharge', 'sepsis', 'hyperbilirubinemia', 'hypoglycemia'];
  if (!validCategories.includes(category)) {
    throw new ValidationError([{ field: 'category', message: `Invalid category. Must be one of: ${validCategories.join(', ')}` }]);
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError([{ field: 'items', message: 'At least one item is required' }]);
  }

  // Validate each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.name || item.name.trim().length === 0) {
      throw new ValidationError([{ field: `items[${i}].name`, message: 'Item name is required' }]);
    }
    if (!item.category) {
      throw new ValidationError([{ field: `items[${i}].category`, message: 'Item category is required' }]);
    }
  }

  const orderSet = await prisma.orderSet.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      category,
      items: JSON.stringify(items),
      active: true,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'create_order_set',
      resource: 'order_set',
      resourceId: orderSet.id,
      details: JSON.stringify({
        name,
        category,
        itemCount: items.length,
      }),
    },
  });

  logger.audit('Order set created', {
    userId: session.user.id,
    orderSetId: orderSet.id,
    name,
    category,
    itemCount: items.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...orderSet,
      items: JSON.parse(orderSet.items),
    },
  }, { status: 201 });
});
