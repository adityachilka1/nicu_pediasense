import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireRole } from '@/lib/security';

// Valid order status transitions
const STATUS_TRANSITIONS = {
  pending: ['active', 'cancelled'],
  active: ['completed', 'discontinued'],
  completed: [], // Terminal state
  discontinued: [], // Terminal state
  cancelled: [], // Terminal state
};

// PUT /api/orders/[id]/status - Update order status
export const PUT = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Clinical staff can update order status
  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse']);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const { id } = await params;
  const orderId = parseInt(id);

  if (isNaN(orderId)) {
    throw new ValidationError([{ field: 'id', message: 'Invalid order ID' }]);
  }

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const { status, discontinueReason, notes } = body;

  if (!status) {
    throw new ValidationError([{ field: 'status', message: 'Status is required' }]);
  }

  const validStatuses = ['pending', 'active', 'completed', 'discontinued', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError([{ field: 'status', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }]);
  }

  // Find the existing order
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      patient: {
        select: { id: true, name: true },
      },
    },
  });

  if (!existingOrder) {
    throw new NotFoundError('Order');
  }

  // Validate status transition
  const allowedTransitions = STATUS_TRANSITIONS[existingOrder.status] || [];
  if (!allowedTransitions.includes(status)) {
    throw new ValidationError([{
      field: 'status',
      message: `Cannot transition from '${existingOrder.status}' to '${status}'. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`,
    }]);
  }

  // Prepare update data
  const updateData = { status };

  if (status === 'discontinued') {
    updateData.discontinuedAt = new Date();
    updateData.discontinuedById = parseInt(session.user.id);
    if (discontinueReason) {
      updateData.discontinueReason = discontinueReason;
    }
  }

  if (status === 'active' && !existingOrder.startTime) {
    updateData.startTime = new Date();
  }

  if (status === 'completed') {
    updateData.endTime = new Date();
  }

  // Update order in transaction
  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
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
      },
    });

    // Create audit log
    await tx.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'update_order_status',
        resource: 'order',
        resourceId: orderId,
        details: JSON.stringify({
          patientId: existingOrder.patientId,
          orderName: existingOrder.name,
          previousStatus: existingOrder.status,
          newStatus: status,
          discontinueReason: discontinueReason || null,
          notes: notes || null,
        }),
      },
    });

    return order;
  });

  logger.audit('Order status updated', {
    userId: session.user.id,
    userName: session.user.name,
    orderId: updatedOrder.id,
    patientId: updatedOrder.patientId,
    orderName: updatedOrder.name,
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
      previousStatus: existingOrder.status,
      timestamp: new Date().toISOString(),
    },
  });
});
