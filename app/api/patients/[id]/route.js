import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { updatePatientSchema, validateRequest, schemas } from '@/lib/validation';
import { withErrorHandler, NotFoundError, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';

// GET /api/patients/[id] - Get a single patient
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { id } = await params;

  // Validate ID
  const idValidation = schemas.idString.safeParse(id);
  if (!idValidation.success) {
    throw new ValidationError([{ field: 'id', message: 'Invalid patient ID' }]);
  }

  const patientId = parseInt(id);

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      bed: true,
      vitals: {
        orderBy: { recordedAt: 'desc' },
        take: 100, // Last 100 vitals readings
      },
      alarms: {
        where: { status: 'active' },
        orderBy: { triggeredAt: 'desc' },
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          author: {
            select: { fullName: true, role: true },
          },
        },
      },
    },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Create audit log for viewing patient
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'view_patient',
      resource: 'patient',
      resourceId: patient.id,
    },
  });

  logger.info('Patient details fetched', {
    userId: session.user.id,
    patientId: patient.id,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({ data: patient });
});

// PATCH /api/patients/[id] - Update a patient
export const PATCH = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const { id } = await params;

  // Validate ID
  const idValidation = schemas.idString.safeParse(id);
  if (!idValidation.success) {
    throw new ValidationError([{ field: 'id', message: 'Invalid patient ID' }]);
  }

  const patientId = parseInt(id);

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(updatePatientSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  // Validate patient exists
  const existing = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { bed: true },
  });

  if (!existing) {
    throw new NotFoundError('Patient');
  }

  const {
    name,
    currentWeight,
    dayOfLife,
    status,
    alarmLimits,
    bedNumber,
  } = validation.data;

  const updateData = {};
  if (name) updateData.name = name;
  if (currentWeight) updateData.currentWeight = currentWeight;
  if (dayOfLife) updateData.dayOfLife = dayOfLife;
  if (status) updateData.status = status;
  if (alarmLimits) updateData.alarmLimits = JSON.stringify(alarmLimits);

  // Handle bed change
  if (bedNumber && bedNumber !== existing.bed?.bedNumber) {
    const newBed = await prisma.bed.findUnique({
      where: { bedNumber },
    });

    if (!newBed) {
      throw new ValidationError([{ field: 'bedNumber', message: 'Bed not found' }]);
    }

    // Check if bed is occupied by another patient
    const bedOccupied = await prisma.patient.findFirst({
      where: { bedId: newBed.id, dischargeDate: null },
    });

    if (bedOccupied && bedOccupied.id !== patientId) {
      throw new ValidationError([{ field: 'bedNumber', message: 'Bed is already occupied' }]);
    }

    updateData.bedId = newBed.id;

    // Update old bed status
    if (existing.bedId) {
      await prisma.bed.update({
        where: { id: existing.bedId },
        data: { status: 'available' },
      });
    }

    // Update new bed status
    await prisma.bed.update({
      where: { id: newBed.id },
      data: { status: 'occupied' },
    });
  }

  const patient = await prisma.patient.update({
    where: { id: patientId },
    data: updateData,
    include: {
      bed: true,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'update_patient',
      resource: 'patient',
      resourceId: patient.id,
      details: JSON.stringify(body),
    },
  });

  logger.audit('Patient updated', {
    userId: session.user.id,
    patientId: patient.id,
    changes: Object.keys(updateData),
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({ data: patient });
});

// DELETE /api/patients/[id] - Discharge a patient
export const DELETE = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Only charge nurses and above can discharge
  requireRole(session, ROLE_GROUPS.LEADERSHIP);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const { id } = await params;

  // Validate ID
  const idValidation = schemas.idString.safeParse(id);
  if (!idValidation.success) {
    throw new ValidationError([{ field: 'id', message: 'Invalid patient ID' }]);
  }

  const patientId = parseInt(id);

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { bed: true },
  });

  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Mark as discharged (soft delete)
  await prisma.patient.update({
    where: { id: patientId },
    data: {
      status: 'discharged',
      dischargeDate: new Date(),
      bedId: null,
    },
  });

  // Free up the bed
  if (patient.bedId) {
    await prisma.bed.update({
      where: { id: patient.bedId },
      data: { status: 'cleaning' },
    });
  }

  // Resolve any active alarms
  await prisma.alarm.updateMany({
    where: { patientId, status: 'active' },
    data: { status: 'resolved', resolvedAt: new Date() },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'discharge_patient',
      resource: 'patient',
      resourceId: patientId,
      details: JSON.stringify({ mrn: patient.mrn, name: patient.name }),
    },
  });

  logger.audit('Patient discharged', {
    userId: session.user.id,
    patientId,
    mrn: patient.mrn,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({ message: 'Patient discharged successfully' });
});
