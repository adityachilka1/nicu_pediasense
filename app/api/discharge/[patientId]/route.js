import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createDischargePlanSchema, updateDischargePlanSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole, ROLE_GROUPS } from '@/lib/security';
import { createAuditLog } from '@/lib/audit';

// Default AAP discharge checklist items
const DEFAULT_CHECKLIST_ITEMS = [
  // Physiologic stability
  { category: 'medical', description: 'Temperature stable in open crib for 24-48 hours', required: true, orderIndex: 1 },
  { category: 'medical', description: 'No apnea/bradycardia/desaturation events for 5-8 days', required: true, orderIndex: 2 },
  { category: 'medical', description: 'Stable respiratory support (room air or home O2 qualified)', required: true, orderIndex: 3 },
  { category: 'medical', description: 'Consistent weight gain (20-30 g/day)', required: true, orderIndex: 4 },
  { category: 'medical', description: 'Full oral feeds (PO or stable G-tube)', required: true, orderIndex: 5 },
  { category: 'medical', description: 'Adequate urine output (6-8 wet diapers/day)', required: true, orderIndex: 6 },
  // Medical screenings
  { category: 'medical', description: 'Newborn metabolic screen complete', required: true, orderIndex: 7 },
  { category: 'medical', description: 'Hearing screen passed (both ears)', required: true, orderIndex: 8 },
  { category: 'medical', description: 'ROP screening: cleared or follow-up scheduled', required: true, orderIndex: 9 },
  { category: 'medical', description: 'Cranial ultrasound complete (if indicated)', required: false, orderIndex: 10 },
  { category: 'medical', description: 'Immunizations up to date', required: true, orderIndex: 11 },
  { category: 'medical', description: 'Car seat challenge passed (90 min observation)', required: true, orderIndex: 12 },
  { category: 'medical', description: 'Hepatitis B vaccine given', required: true, orderIndex: 13 },
  { category: 'medical', description: 'RSV prophylaxis discussed (if eligible)', required: false, orderIndex: 14 },
  // Family education
  { category: 'education', description: 'Infant CPR training completed', required: true, orderIndex: 15 },
  { category: 'education', description: 'Feeding demonstration (breast/bottle/tube)', required: true, orderIndex: 16 },
  { category: 'education', description: 'Medication administration training', required: true, orderIndex: 17 },
  { category: 'education', description: 'Equipment training (monitors, O2, feeding pump)', required: false, orderIndex: 18 },
  { category: 'education', description: 'Safe sleep education (Back to Sleep)', required: true, orderIndex: 19 },
  { category: 'education', description: 'Shaken baby prevention education', required: true, orderIndex: 20 },
  { category: 'safety', description: 'Home environment assessed (smoke-free, safe)', required: true, orderIndex: 21 },
  { category: 'education', description: 'Signs of illness teaching (when to call/go to ED)', required: true, orderIndex: 22 },
  // Administrative
  { category: 'followup', description: 'Primary care provider identified', required: true, orderIndex: 23 },
  { category: 'documentation', description: 'Insurance verified/Medicaid enrolled', required: true, orderIndex: 24 },
  { category: 'documentation', description: 'Discharge summary completed', required: true, orderIndex: 25 },
  { category: 'documentation', description: 'Prescriptions written and filled', required: true, orderIndex: 26 },
  { category: 'equipment', description: 'Home nursing arranged (if needed)', required: false, orderIndex: 27 },
  { category: 'followup', description: 'Follow-up appointments scheduled', required: true, orderIndex: 28 },
  { category: 'followup', description: 'Early Intervention referral (if indicated)', required: false, orderIndex: 29 },
  { category: 'documentation', description: 'Birth certificate completed', required: true, orderIndex: 30 },
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
