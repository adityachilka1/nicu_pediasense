import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createFamilyMessageSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { createAuditLog } from '@/lib/audit';

// GET /api/family/messages/[patientId] - Get messages for a patient's family contacts
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
    include: {
      familyContacts: {
        where: { active: true },
        select: { id: true, firstName: true, lastName: true, relationship: true },
      },
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  const { searchParams } = new URL(request.url);
  const familyContactId = searchParams.get('familyContactId');
  const messageType = searchParams.get('messageType');
  const status = searchParams.get('status');
  const isInbound = searchParams.get('isInbound');

  // Parse pagination
  const { limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 50,
    maxLimit: 100,
  });

  // Build query filters
  const familyContactIds = patient.familyContacts.map(fc => fc.id);

  if (familyContactIds.length === 0) {
    return NextResponse.json(
      createPaginatedResponse({
        data: [],
        total: 0,
        limit,
        offset,
        additionalMeta: {
          patientId,
          patientName: patient.name,
          familyContacts: [],
        },
      })
    );
  }

  const where = {
    familyContactId: familyContactId
      ? parseInt(familyContactId)
      : { in: familyContactIds },
  };

  if (messageType) {
    where.messageType = messageType;
  }

  if (status) {
    where.status = status;
  }

  if (isInbound !== null && isInbound !== undefined) {
    where.isInbound = isInbound === 'true';
  }

  // Execute query
  const [messages, total] = await Promise.all([
    prisma.familyMessage.findMany({
      where,
      include: {
        familyContact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            relationship: true,
            email: true,
            phone: true,
          },
        },
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
            initials: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.familyMessage.count({ where }),
  ]);

  // Audit log for PHI access
  await createAuditLog({
    userId: parseInt(session.user.id),
    action: 'view_family_messages',
    resource: 'patient',
    resourceId: patientId,
    details: JSON.stringify({ messageCount: messages.length }),
    ipAddress: clientIP,
  });

  logger.info('Fetched family messages', {
    userId: session.user.id,
    patientId,
    messageCount: messages.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json(
    createPaginatedResponse({
      data: messages.map(msg => ({
        ...msg,
        from: msg.isInbound
          ? `${msg.familyContact.firstName} ${msg.familyContact.lastName}`
          : msg.sender?.fullName || 'NICU Team',
        to: msg.isInbound
          ? 'NICU Team'
          : `${msg.familyContact.firstName} ${msg.familyContact.lastName}`,
      })),
      total,
      limit,
      offset,
      additionalMeta: {
        patientId,
        patientName: patient.name,
        familyContacts: patient.familyContacts.map(fc => ({
          id: fc.id,
          name: `${fc.firstName} ${fc.lastName}`,
          relationship: fc.relationship,
        })),
      },
    })
  );
});

// POST /api/family/messages/[patientId] - Send a message to a family contact
export const POST = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Clinical staff can send messages
  requireRole(session, ROLE_GROUPS.ALL_CLINICAL);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // In Next.js 15, params is a Promise
  const resolvedParams = await params;
  const patientId = parseInt(resolvedParams.patientId);
  if (isNaN(patientId)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(createFamilyMessageSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const { familyContactId, subject, content, messageType, channel } = validation.data;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Verify family contact exists and belongs to this patient
  const familyContact = await prisma.familyContact.findUnique({
    where: { id: familyContactId },
  });

  if (!familyContact) {
    throw new NotFoundError('Family contact');
  }

  if (familyContact.patientId !== patientId) {
    throw new ValidationError([{
      field: 'familyContactId',
      message: 'Family contact does not belong to this patient'
    }]);
  }

  // Create message
  const message = await prisma.familyMessage.create({
    data: {
      familyContactId,
      senderId: parseInt(session.user.id),
      subject,
      content,
      messageType,
      channel,
      status: 'pending',
      isInbound: false,
    },
    include: {
      familyContact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          relationship: true,
        },
      },
      sender: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
  });

  // In a real implementation, this would trigger the actual message sending
  // For now, we'll mark it as sent immediately
  await prisma.familyMessage.update({
    where: { id: message.id },
    data: {
      status: 'sent',
      sentAt: new Date(),
    },
  });

  // Audit log
  await createAuditLog({
    userId: parseInt(session.user.id),
    action: 'send_family_message',
    resource: 'patient',
    resourceId: patientId,
    details: JSON.stringify({
      familyContactId,
      messageType,
      channel,
    }),
    ipAddress: clientIP,
  });

  logger.audit('Family message sent', {
    userId: session.user.id,
    patientId,
    familyContactId,
    messageId: message.id,
    messageType,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...message,
      status: 'sent',
      sentAt: new Date().toISOString(),
      from: message.sender?.fullName || 'NICU Team',
      to: `${message.familyContact.firstName} ${message.familyContact.lastName}`,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }, { status: 201 });
});
