import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth } from '@/lib/security';
import { z } from 'zod';

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

// Query params schema for GET
const familyQuerySchema = z.object({
  patientId: z.string().regex(/^\d+$/, 'Patient ID must be numeric').transform(Number),
  includeMessages: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  includeEducation: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
});

// Schema for creating a family contact
const createFamilyContactSchema = z.object({
  patientId: z.number().int().positive('Patient ID must be a positive integer'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  relationship: z.enum(['mother', 'father', 'guardian', 'grandparent', 'sibling', 'other'], {
    errorMap: () => ({ message: 'Invalid relationship type' }),
  }),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().regex(/^[+]?[\d\s()-]{10,20}$/, 'Invalid phone number format').optional().nullable(),
  preferredContact: z.enum(['phone', 'email', 'both']).default('phone'),
  isPrimaryContact: z.boolean().default(false),
  canReceiveUpdates: z.boolean().default(true),
  canViewRecords: z.boolean().default(false),
});

// Schema for sending a message to family
const sendMessageSchema = z.object({
  familyContactId: z.number().int().positive('Family contact ID is required'),
  subject: z.string().max(200).optional().nullable(),
  content: z.string().min(1, 'Message content is required').max(5000),
  messageType: z.enum(['general', 'update', 'alert', 'education']).default('general'),
  channel: z.enum(['app', 'email', 'sms']).default('app'),
});

// Schema for updating education progress
const updateEducationProgressSchema = z.object({
  familyContactId: z.number().int().positive('Family contact ID is required'),
  materialId: z.number().int().positive('Material ID is required'),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  timeSpentSeconds: z.number().int().min(0).optional(),
  quizScore: z.number().min(0).max(100).optional().nullable(),
});

// =====================================================
// GET /api/family - Get family contacts for a patient
// =====================================================
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);

  // Parse and validate query parameters
  const queryResult = familyQuerySchema.safeParse({
    patientId: searchParams.get('patientId'),
    includeMessages: searchParams.get('includeMessages') || 'false',
    includeEducation: searchParams.get('includeEducation') || 'false',
  });

  if (!queryResult.success) {
    const errors = queryResult.error?.errors || [];
    throw new ValidationError(
      errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message || 'Validation error',
      }))
    );
  }

  const { patientId, includeMessages, includeEducation } = queryResult.data;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, name: true, mrn: true },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Build include clause dynamically
  const include = {};
  if (includeMessages) {
    include.messages = {
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        sender: {
          select: { fullName: true },
        },
      },
    };
  }
  if (includeEducation) {
    include.educationProgress = {
      include: {
        material: {
          select: {
            id: true,
            title: true,
            category: true,
            contentType: true,
            estimatedMinutes: true,
          },
        },
      },
    };
  }

  // Fetch family contacts
  const familyContacts = await prisma.familyContact.findMany({
    where: {
      patientId,
      active: true,
    },
    include: Object.keys(include).length > 0 ? include : undefined,
    orderBy: [
      { isPrimaryContact: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  // Transform for frontend
  const transformed = familyContacts.map(contact => ({
    id: contact.id,
    patientId: contact.patientId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: `${contact.firstName} ${contact.lastName}`,
    relationship: contact.relationship,
    email: contact.email,
    phone: contact.phone,
    preferredContact: contact.preferredContact,
    isPrimaryContact: contact.isPrimaryContact,
    canReceiveUpdates: contact.canReceiveUpdates,
    canViewRecords: contact.canViewRecords,
    verified: !!contact.verifiedAt,
    verifiedAt: contact.verifiedAt?.toISOString(),
    createdAt: contact.createdAt.toISOString(),
    ...(includeMessages && {
      recentMessages: contact.messages?.map(msg => ({
        id: msg.id,
        subject: msg.subject,
        content: msg.content,
        messageType: msg.messageType,
        status: msg.status,
        channel: msg.channel,
        isInbound: msg.isInbound,
        senderName: msg.sender?.fullName,
        createdAt: msg.createdAt.toISOString(),
      })),
    }),
    ...(includeEducation && {
      educationProgress: contact.educationProgress?.map(prog => ({
        materialId: prog.materialId,
        materialTitle: prog.material.title,
        category: prog.material.category,
        contentType: prog.material.contentType,
        estimatedMinutes: prog.material.estimatedMinutes,
        status: prog.status,
        startedAt: prog.startedAt?.toISOString(),
        completedAt: prog.completedAt?.toISOString(),
        timeSpentSeconds: prog.timeSpentSeconds,
        quizScore: prog.quizScore,
      })),
    }),
  }));

  // Calculate education summary if requested
  let educationSummary = null;
  if (includeEducation && transformed.length > 0) {
    const allProgress = transformed.flatMap(c => c.educationProgress || []);
    const completed = allProgress.filter(p => p.status === 'completed').length;
    const inProgress = allProgress.filter(p => p.status === 'in_progress').length;
    const notStarted = allProgress.filter(p => p.status === 'not_started').length;

    educationSummary = {
      total: allProgress.length,
      completed,
      inProgress,
      notStarted,
      completionRate: allProgress.length > 0 ? Math.round((completed / allProgress.length) * 100) : 0,
    };
  }

  logger.info('Family contacts fetched', {
    userId: session.user.id,
    patientId,
    contactCount: transformed.length,
    includeMessages,
    includeEducation,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    meta: {
      patientId,
      patientName: patient.name,
      total: transformed.length,
      primaryContact: transformed.find(c => c.isPrimaryContact)?.fullName || null,
      ...(educationSummary && { educationSummary }),
      timestamp: new Date().toISOString(),
    },
  });
});

// =====================================================
// POST /api/family - Create contact, send message, or update education
// =====================================================
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and sanitize request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  // Determine action type based on request body
  const { action = 'createContact' } = body;

  let result;
  let logAction;

  switch (action) {
    case 'createContact': {
      const validation = validateRequest(createFamilyContactSchema, body);
      if (!validation.success) {
        throw new ValidationError(validation.errors);
      }

      const { patientId, ...contactData } = validation.data;

      // Verify patient exists
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
      });
      if (!patient) {
        throw new NotFoundError('Patient');
      }

      // If setting as primary, unset other primary contacts
      if (contactData.isPrimaryContact) {
        await prisma.familyContact.updateMany({
          where: { patientId, isPrimaryContact: true },
          data: { isPrimaryContact: false },
        });
      }

      // Create the contact
      result = await prisma.familyContact.create({
        data: {
          patientId,
          ...contactData,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: 'create_family_contact',
          resource: 'family_contact',
          resourceId: result.id,
          details: JSON.stringify({ patientId, relationship: contactData.relationship }),
        },
      });

      logAction = 'Family contact created';
      break;
    }

    case 'sendMessage': {
      const validation = validateRequest(sendMessageSchema, body);
      if (!validation.success) {
        throw new ValidationError(validation.errors);
      }

      const { familyContactId, ...messageData } = validation.data;

      // Verify family contact exists
      const familyContact = await prisma.familyContact.findUnique({
        where: { id: familyContactId },
        include: { patient: { select: { id: true, name: true } } },
      });
      if (!familyContact) {
        throw new NotFoundError('Family contact');
      }

      // Create the message
      result = await prisma.familyMessage.create({
        data: {
          familyContactId,
          senderId: parseInt(session.user.id),
          ...messageData,
          status: 'pending',
          sentAt: new Date(),
        },
      });

      // In a real system, you would trigger the actual message delivery here
      // For now, we simulate immediate delivery for 'app' channel
      if (messageData.channel === 'app') {
        await prisma.familyMessage.update({
          where: { id: result.id },
          data: { status: 'delivered', deliveredAt: new Date() },
        });
        result.status = 'delivered';
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: 'send_family_message',
          resource: 'family_message',
          resourceId: result.id,
          details: JSON.stringify({
            familyContactId,
            patientId: familyContact.patient.id,
            messageType: messageData.messageType,
            channel: messageData.channel,
          }),
        },
      });

      logAction = 'Family message sent';
      break;
    }

    case 'updateEducation': {
      const validation = validateRequest(updateEducationProgressSchema, body);
      if (!validation.success) {
        throw new ValidationError(validation.errors);
      }

      const { familyContactId, materialId, status, timeSpentSeconds, quizScore } = validation.data;

      // Verify family contact exists
      const familyContact = await prisma.familyContact.findUnique({
        where: { id: familyContactId },
      });
      if (!familyContact) {
        throw new NotFoundError('Family contact');
      }

      // Verify education material exists
      const material = await prisma.educationMaterial.findUnique({
        where: { id: materialId },
      });
      if (!material) {
        throw new NotFoundError('Education material');
      }

      // Prepare update data
      const updateData = {
        status,
        ...(timeSpentSeconds !== undefined && { timeSpentSeconds }),
        ...(quizScore !== undefined && { quizScore }),
      };

      // Set timestamps based on status
      if (status === 'in_progress' && !updateData.startedAt) {
        updateData.startedAt = new Date();
      }
      if (status === 'completed') {
        updateData.completedAt = new Date();
        updateData.attempts = { increment: 1 };
      }

      // Upsert the progress record
      result = await prisma.educationProgress.upsert({
        where: {
          familyContactId_materialId: {
            familyContactId,
            materialId,
          },
        },
        create: {
          familyContactId,
          materialId,
          status,
          startedAt: status !== 'not_started' ? new Date() : null,
          completedAt: status === 'completed' ? new Date() : null,
          timeSpentSeconds: timeSpentSeconds || 0,
          quizScore,
          attempts: status === 'completed' ? 1 : 0,
        },
        update: updateData,
        include: {
          material: {
            select: { title: true, category: true },
          },
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: 'update_education_progress',
          resource: 'education_progress',
          resourceId: result.id,
          details: JSON.stringify({ familyContactId, materialId, status }),
        },
      });

      logAction = 'Education progress updated';
      break;
    }

    default:
      throw new ValidationError([{ field: 'action', message: 'Invalid action type' }]);
  }

  logger.audit(logAction, {
    userId: session.user.id,
    action,
    resultId: result.id,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    message: logAction,
    data: result,
    meta: {
      action,
      timestamp: new Date().toISOString(),
    },
  });
});
