import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, NotFoundError, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth, requireRole } from '@/lib/security';

// GET /api/orders/[id] - Get a single order
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { id } = await params;
  const orderId = parseInt(id);

  if (isNaN(orderId)) {
    throw new ValidationError([{ field: 'id', message: 'Invalid order ID' }]);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
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
      orderSet: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order');
  }

  logger.info('Fetched order', {
    userId: session.user.id,
    orderId: order.id,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...order,
      details: order.details ? JSON.parse(order.details) : null,
    },
  });
});
