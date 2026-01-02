import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createDischargePlanSchema, updateDischargePlanSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { createAuditLog } from '@/lib/audit';

// Default AAP discharge checklist items (using Prisma enum values)
const DEFAULT_CHECKLIST_ITEMS = [
  // Physiologic stability (MEDICAL_STABILITY)
  { category: 'MEDICAL_STABILITY', description: 'Temperature stable in open crib for 24-48 hours', required: true, orderIndex: 1 },
  { category: 'MEDICAL_STABILITY', description: 'No apnea/bradycardia/desaturation events for 5-8 days', required: true, orderIndex: 2 },
  { category: 'MEDICAL_STABILITY', description: 'Stable respiratory support (room air or home O2 qualified)', required: true, orderIndex: 3 },
  { category: 'MEDICAL_STABILITY', description: 'Consistent weight gain (20-30 g/day)', required: true, orderIndex: 4 },
  // Feeding & Nutrition
  { category: 'FEEDING_NUTRITION', description: 'Full oral feeds (PO or stable G-tube)', required: true, orderIndex: 5 },
  { category: 'FEEDING_NUTRITION', description: 'Adequate urine output (6-8 wet diapers/day)', required: true, orderIndex: 6 },
  // Hearing screening
  { category: 'HEARING_SCREENING', description: 'Hearing screen passed (both ears)', required: true, orderIndex: 7 },
  // Immunizations
  { category: 'IMMUNIZATIONS', description: 'Newborn metabolic screen complete', required: true, orderIndex: 8 },
  { category: 'IMMUNIZATIONS', description: 'Immunizations up to date', required: true, orderIndex: 9 },
  { category: 'IMMUNIZATIONS', description: 'Hepatitis B vaccine given', required: true, orderIndex: 10 },
  { category: 'IMMUNIZATIONS', description: 'RSV prophylaxis discussed (if eligible)', required: false, orderIndex: 11 },
  // Medical screenings (OTHER category for misc medical)
  { category: 'OTHER', description: 'ROP screening: cleared or follow-up scheduled', required: true, orderIndex: 12 },
  { category: 'OTHER', description: 'Cranial ultrasound complete (if indicated)', required: false, orderIndex: 13 },
  // Car seat safety
  { category: 'CAR_SEAT_SAFETY', description: 'Car seat challenge passed (90 min observation)', required: true, orderIndex: 14 },
  // Family education
  { category: 'FAMILY_EDUCATION', description: 'Infant CPR training completed', required: true, orderIndex: 15 },
  { category: 'FAMILY_EDUCATION', description: 'Feeding demonstration (breast/bottle/tube)', required: true, orderIndex: 16 },
  { category: 'FAMILY_EDUCATION', description: 'Medication administration training', required: true, orderIndex: 17 },
  { category: 'FAMILY_EDUCATION', description: 'Equipment training (monitors, O2, feeding pump)', required: false, orderIndex: 18 },
  { category: 'FAMILY_EDUCATION', description: 'Safe sleep education (Back to Sleep)', required: true, orderIndex: 19 },
  { category: 'FAMILY_EDUCATION', description: 'Shaken baby prevention education', required: true, orderIndex: 20 },
  { category: 'FAMILY_EDUCATION', description: 'Signs of illness teaching (when to call/go to ED)', required: true, orderIndex: 21 },
  // Social services (home assessment)
  { category: 'SOCIAL_SERVICES', description: 'Home environment assessed (smoke-free, safe)', required: true, orderIndex: 22 },
  // Follow-up
  { category: 'FOLLOW_UP', description: 'Primary care provider identified', required: true, orderIndex: 23 },
  { category: 'FOLLOW_UP', description: 'Follow-up appointments scheduled', required: true, orderIndex: 24 },
  { category: 'FOLLOW_UP', description: 'Early Intervention referral (if indicated)', required: false, orderIndex: 25 },
  // Documentation
  { category: 'DOCUMENTATION', description: 'Insurance verified/Medicaid enrolled', required: true, orderIndex: 26 },
  { category: 'DOCUMENTATION', description: 'Discharge summary completed', required: true, orderIndex: 27 },
  { category: 'DOCUMENTATION', description: 'Birth certificate completed', required: true, orderIndex: 28 },
  // Medications
  { category: 'MEDICATIONS', description: 'Prescriptions written and filled', required: true, orderIndex: 29 },
  // Equipment/DME
  { category: 'EQUIPMENT_DME', description: 'Home nursing arranged (if needed)', required: false, orderIndex: 30 },
];

// GET /api/discharge/[patientId] - Get discharge plan for a patient
export const GET = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const patientId = parseInt(params.patientId);
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

  // Get or create discharge plan
  let dischargePlan = await prisma.dischargePlan.findUnique({
    where: { patientId },
    include: {
      checklistItems: {
        orderBy: { orderIndex: 'asc' },
      },
      createdBy: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
  });

  // If no discharge plan exists, create one with default checklist
  if (!dischargePlan) {
    dischargePlan = await prisma.dischargePlan.create({
      data: {
        patientId,
        createdById: parseInt(session.user.id),
        status: 'planning',
        checklistItems: {
          create: DEFAULT_CHECKLIST_ITEMS,
        },
      },
      include: {
        checklistItems: {
          orderBy: { orderIndex: 'asc' },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    logger.info('Created new discharge plan', {
      userId: session.user.id,
      patientId,
      dischargePlanId: dischargePlan.id,
    });
  }

  // Calculate readiness score
  const { checklistItems } = dischargePlan;
  const requiredItems = checklistItems.filter(item => item.required && item.status !== 'not_applicable');
  const completedRequired = requiredItems.filter(item => item.status === 'completed');
  const readinessScore = requiredItems.length > 0
    ? Math.round((completedRequired.length / requiredItems.length) * 100)
    : 0;

  // Group items by category
  const groupedItems = checklistItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  // Calculate category progress
  const categoryProgress = Object.entries(groupedItems).map(([category, items]) => {
    const applicable = items.filter(i => i.status !== 'not_applicable');
    const completed = applicable.filter(i => i.status === 'completed');
    return {
      category,
      total: items.length,
      applicable: applicable.length,
      completed: completed.length,
      progress: applicable.length > 0 ? Math.round((completed.length / applicable.length) * 100) : 0,
    };
  });

  // Audit log for PHI access
  await createAuditLog({
    userId: parseInt(session.user.id),
    action: 'view_discharge_plan',
    resource: 'patient',
    resourceId: patientId,
    details: JSON.stringify({ dischargePlanId: dischargePlan.id }),
    ipAddress: clientIP,
  });

  logger.info('Fetched discharge plan', {
    userId: session.user.id,
    patientId,
    dischargePlanId: dischargePlan.id,
    readinessScore,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...dischargePlan,
      patient,
      groupedItems,
      readinessScore,
      categoryProgress,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// PUT /api/discharge/[patientId] - Update discharge plan
export const PUT = withErrorHandler(async (request, { params }) => {
  const timer = createTimer();
  const session = await auth();

  // Authorization: Leadership can update discharge plans
  requireRole(session, ROLE_GROUPS.LEADERSHIP);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const patientId = parseInt(params.patientId);
  if (isNaN(patientId)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const validation = validateRequest(updateDischargePlanSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  // Verify discharge plan exists
  const existingPlan = await prisma.dischargePlan.findUnique({
    where: { patientId },
  });

  if (!existingPlan) {
    throw new NotFoundError('Discharge plan');
  }

  // Update discharge plan
  const dischargePlan = await prisma.dischargePlan.update({
    where: { patientId },
    data: {
      ...validation.data,
      estimatedDate: validation.data.estimatedDate ? new Date(validation.data.estimatedDate) : undefined,
      actualDate: validation.data.actualDate ? new Date(validation.data.actualDate) : undefined,
    },
    include: {
      checklistItems: {
        orderBy: { orderIndex: 'asc' },
      },
      createdBy: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
  });

  // If status changed to 'discharged', update patient status
  if (validation.data.status === 'discharged') {
    await prisma.patient.update({
      where: { id: patientId },
      data: {
        status: 'discharged',
        dischargeDate: new Date(),
      },
    });
  }

  // Audit log
  await createAuditLog({
    userId: parseInt(session.user.id),
    action: 'update_discharge_plan',
    resource: 'patient',
    resourceId: patientId,
    details: JSON.stringify({
      dischargePlanId: dischargePlan.id,
      changes: Object.keys(validation.data),
    }),
    ipAddress: clientIP,
  });

  logger.audit('Discharge plan updated', {
    userId: session.user.id,
    patientId,
    dischargePlanId: dischargePlan.id,
    changes: Object.keys(validation.data),
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: dischargePlan,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});
