import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createOrderSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';

// GET /api/orders - List orders for a patient
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const includeOrderSets = searchParams.get('includeOrderSets') === 'true';

  // Parse pagination parameters
  const { limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 50,
    maxLimit: 100,
  });

  // Build query filters
  const where = {};

  if (patientId) {
    where.patientId = parseInt(patientId);
  }

  // Map status to Prisma enum
  const statusMap = {
    pending: 'PENDING',
    active: 'ACTIVE',
    completed: 'COMPLETED',
    discontinued: 'DISCONTINUED',
    cancelled: 'CANCELLED',
  };

  if (status) {
    const mappedStatus = statusMap[status.toLowerCase()] || status.toUpperCase();
    where.status = mappedStatus;
  }

  // Map category to Prisma enum
  const categoryMap = {
    medication: 'MEDICATION',
    lab: 'LAB',
    imaging: 'IMAGING',
    diet: 'DIET',
    nursing: 'NURSING',
    respiratory: 'RESPIRATORY',
    procedure: 'PROCEDURE',
  };

  if (category) {
    const mappedCategory = categoryMap[category.toLowerCase()] || category.toUpperCase();
    where.category = mappedCategory;
  }

  // Fetch orders and count in parallel
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            name: true,
          },
        },
        ordering: {
          select: {
            id: true,
            fullName: true,
            initials: true,
            role: true,
          },
        },
        discontinuedBy: {
          select: {
            id: true,
            fullName: true,
            initials: true,
          },
        },
        orderSet: includeOrderSets ? {
          select: {
            id: true,
            name: true,
            category: true,
          },
        } : false,
      },
      orderBy: [
        { priority: 'asc' }, // stat first
        { createdAt: 'desc' },
      ],
      skip: offset,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  // Transform orders with parsed JSON details
  const transformed = orders.map(order => ({
    ...order,
    details: order.details ? JSON.parse(order.details) : null,
  }));

  // Fetch order sets if requested
  let orderSets = [];
  if (includeOrderSets) {
    orderSets = await prisma.orderSet.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    orderSets = orderSets.map(set => ({
      ...set,
      items: set.items ? JSON.parse(set.items) : [],
    }));
  }

  // Get order categories summary
  const categorySummary = await prisma.order.groupBy({
    by: ['category'],
    where: patientId ? { patientId: parseInt(patientId), status: { in: ['PENDING', 'ACTIVE'] } } : { status: { in: ['PENDING', 'ACTIVE'] } },
    _count: true,
  });

  logger.info('Fetched orders', {
    userId: session.user.id,
    patientId,
    count: transformed.length,
    total,
    limit,
    offset,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json(
    createPaginatedResponse({
      data: transformed,
      total,
      limit,
      offset,
      additionalMeta: {
        categorySummary: categorySummary.reduce((acc, item) => {
          acc[item.category] = item._count;
          return acc;
        }, {}),
        orderSets: includeOrderSets ? orderSets : undefined,
      },
    })
  );
});

// POST /api/orders - Create a new order
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Physicians and charge nurses can create orders
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'Physician', 'Charge Nurse', 'Admin']);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(createOrderSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const {
    patientId,
    category,
    orderType,
    priority,
    orderSetId,
    name,
    details,
    instructions,
    startTime,
    endTime,
  } = validation.data;

  // Map lowercase values to Prisma uppercase enum values
  const categoryMap = {
    medication: 'MEDICATION',
    lab: 'LAB',
    imaging: 'IMAGING',
    diet: 'DIET',
    nursing: 'NURSING',
    respiratory: 'RESPIRATORY',
    procedure: 'PROCEDURE',
    consultation: 'CONSULTATION',
    therapy: 'THERAPY',
    equipment: 'EQUIPMENT',
  };

  const orderTypeMap = {
    one_time: 'ONE_TIME',
    recurring: 'RECURRING',
    prn: 'PRN',
    continuous: 'CONTINUOUS',
    standing: 'STANDING',
  };

  const priorityMap = {
    stat: 'STAT',
    urgent: 'URGENT',
    routine: 'ROUTINE',
    scheduled: 'SCHEDULED',
    prn: 'PRN',
  };

  const prismaCategory = categoryMap[category] || category.toUpperCase();
  const prismaOrderType = orderTypeMap[orderType] || orderType.toUpperCase().replace(/-/g, '_');
  const prismaPriority = priorityMap[priority || 'routine'] || 'ROUTINE';

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });
  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Verify order set if provided
  if (orderSetId) {
    const orderSet = await prisma.orderSet.findUnique({
      where: { id: orderSetId },
    });
    if (!orderSet || !orderSet.active) {
      throw new ValidationError([{ field: 'orderSetId', message: 'Order set not found or inactive' }]);
    }
  }

  // Create order
  const order = await prisma.order.create({
    data: {
      patientId,
      orderingId: parseInt(session.user.id),
      category: prismaCategory,
      orderType: prismaOrderType,
      priority: prismaPriority,
      orderSetId,
      name,
      details: details ? JSON.stringify(details) : null,
      instructions,
      status: 'PENDING',
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
    },
    include: {
      patient: {
        select: {
          id: true,
          mrn: true,
          name: true,
        },
      },
      ordering: {
        select: {
          id: true,
          fullName: true,
          initials: true,
          role: true,
        },
      },
      orderSet: orderSetId ? {
        select: {
          id: true,
          name: true,
        },
      } : false,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'create_order',
      resource: 'order',
      resourceId: order.id,
      details: JSON.stringify({
        patientId,
        category,
        orderType,
        priority,
        name,
      }),
    },
  });

  logger.audit('Order created', {
    userId: session.user.id,
    orderId: order.id,
    patientId,
    category,
    priority,
    duration: `${timer.elapsed()}ms`,
  });

  // Transform response
  const response = {
    ...order,
    details: order.details ? JSON.parse(order.details) : null,
  };

  return NextResponse.json({ data: response }, { status: 201 });
});

// PUT /api/orders - Update order status (discontinue/complete)
export const PUT = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse', 'Physician', 'Charge Nurse', 'Staff Nurse', 'Admin']);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const { orderId, status, discontinueReason } = body;

  if (!orderId) {
    throw new ValidationError([{ field: 'orderId', message: 'Order ID is required' }]);
  }

  // Find the order
  const existingOrder = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
  });

  if (!existingOrder) {
    throw new NotFoundError('Order');
  }

  // Prepare update data
  const updateData = {};

  if (status) {
    // Map status to uppercase Prisma enum
    const statusEnumMap = {
      pending: 'PENDING',
      active: 'ACTIVE',
      completed: 'COMPLETED',
      discontinued: 'DISCONTINUED',
      cancelled: 'CANCELLED',
      PENDING: 'PENDING',
      ACTIVE: 'ACTIVE',
      COMPLETED: 'COMPLETED',
      DISCONTINUED: 'DISCONTINUED',
      CANCELLED: 'CANCELLED',
    };
    const mappedStatus = statusEnumMap[status] || status.toUpperCase();
    const validStatuses = ['PENDING', 'ACTIVE', 'COMPLETED', 'DISCONTINUED', 'CANCELLED'];
    if (!validStatuses.includes(mappedStatus)) {
      throw new ValidationError([{ field: 'status', message: 'Invalid status' }]);
    }
    updateData.status = mappedStatus;

    // Track discontinuation
    if (mappedStatus === 'DISCONTINUED') {
      updateData.discontinuedAt = new Date();
      updateData.discontinuedById = parseInt(session.user.id);
      if (discontinueReason) {
        updateData.discontinueReason = discontinueReason;
      }
    }
  }

  // Update order
  const updatedOrder = await prisma.order.update({
    where: { id: parseInt(orderId) },
    data: updateData,
    include: {
      patient: {
        select: {
          id: true,
          mrn: true,
          name: true,
        },
      },
      ordering: {
        select: {
          id: true,
          fullName: true,
          initials: true,
        },
      },
      discontinuedBy: {
        select: {
          id: true,
          fullName: true,
          initials: true,
        },
      },
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'update_order',
      resource: 'order',
      resourceId: updatedOrder.id,
      details: JSON.stringify({
        previousStatus: existingOrder.status,
        newStatus: status,
        discontinueReason,
      }),
    },
  });

  logger.audit('Order updated', {
    userId: session.user.id,
    orderId: updatedOrder.id,
    patientId: updatedOrder.patientId,
    previousStatus: existingOrder.status,
    newStatus: status,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...updatedOrder,
      details: updatedOrder.details ? JSON.parse(updatedOrder.details) : null,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});
