import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler, ValidationError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';

// Default protocol templates for NICU care plans
const DEFAULT_TEMPLATES = [
  {
    id: 'rds',
    name: 'RDS Management',
    category: 'respiratory',
    description: 'Respiratory Distress Syndrome management protocol',
    steps: 8,
    phases: [
      {
        name: 'Initial Stabilization',
        tasks: [
          { description: 'Surfactant administration', itemType: 'intervention' },
          { description: 'Intubation if needed', itemType: 'intervention' },
          { description: 'Initial ventilator settings', itemType: 'intervention' },
        ],
      },
      {
        name: 'Acute Management',
        tasks: [
          { description: 'Optimize ventilator settings', itemType: 'intervention' },
          { description: 'Daily chest X-ray', itemType: 'assessment' },
          { description: 'Blood gas monitoring Q6H', itemType: 'assessment' },
        ],
      },
      {
        name: 'Weaning Phase',
        tasks: [
          { description: 'Reduce FiO2 to <30%', itemType: 'intervention' },
          { description: 'Reduce PIP by 1-2 q12h', itemType: 'intervention' },
          { description: 'Assess extubation readiness', itemType: 'assessment' },
          { description: 'Caffeine therapy', itemType: 'intervention' },
        ],
      },
      {
        name: 'Post-Extubation',
        tasks: [
          { description: 'CPAP/NIPPV support', itemType: 'intervention' },
          { description: 'Monitor for reintubation criteria', itemType: 'assessment' },
          { description: 'Transition to high-flow/room air', itemType: 'intervention' },
        ],
      },
    ],
  },
  {
    id: 'sepsis',
    name: 'Late-Onset Sepsis',
    category: 'infection',
    description: 'Suspected late-onset sepsis workup and treatment',
    steps: 6,
    phases: [
      {
        name: 'Workup',
        tasks: [
          { description: 'Blood culture x2', itemType: 'task' },
          { description: 'CBC with differential', itemType: 'task' },
          { description: 'CRP/Procalcitonin', itemType: 'task' },
          { description: 'Consider lumbar puncture', itemType: 'assessment' },
        ],
      },
      {
        name: 'Initial Treatment',
        tasks: [
          { description: 'Start empiric antibiotics', itemType: 'intervention' },
          { description: 'Fluid resuscitation if needed', itemType: 'intervention' },
        ],
      },
      {
        name: 'Monitoring',
        tasks: [
          { description: 'Vital signs Q2H', itemType: 'assessment' },
          { description: 'Repeat labs at 24-48h', itemType: 'task' },
          { description: 'Review culture results', itemType: 'assessment' },
        ],
      },
      {
        name: 'Resolution',
        tasks: [
          { description: 'Narrow antibiotics based on culture', itemType: 'intervention' },
          { description: 'Complete antibiotic course', itemType: 'intervention' },
          { description: 'Document treatment duration', itemType: 'task' },
        ],
      },
    ],
  },
  {
    id: 'nec',
    name: 'NEC Prevention',
    category: 'nutrition',
    description: 'Necrotizing Enterocolitis prevention protocol',
    steps: 5,
    phases: [
      {
        name: 'Risk Assessment',
        tasks: [
          { description: 'Identify risk factors', itemType: 'assessment' },
          { description: 'Document feeding intolerance history', itemType: 'assessment' },
        ],
      },
      {
        name: 'Feeding Protocol',
        tasks: [
          { description: 'Start trophic feeds', itemType: 'intervention' },
          { description: 'Advance feeds per protocol', itemType: 'intervention' },
          { description: 'Prefer human milk', itemType: 'intervention' },
        ],
      },
      {
        name: 'Monitoring',
        tasks: [
          { description: 'Abdominal assessment Q shift', itemType: 'assessment' },
          { description: 'Monitor gastric residuals', itemType: 'assessment' },
          { description: 'Track feeding tolerance', itemType: 'assessment' },
        ],
      },
    ],
  },
  {
    id: 'hyperbili',
    name: 'Hyperbilirubinemia',
    category: 'growth',
    description: 'Jaundice management protocol',
    steps: 4,
    phases: [
      {
        name: 'Assessment',
        tasks: [
          { description: 'Total and direct bilirubin', itemType: 'task' },
          { description: 'Blood type and Coombs', itemType: 'task' },
          { description: 'Plot on Bhutani curve', itemType: 'assessment' },
        ],
      },
      {
        name: 'Phototherapy',
        tasks: [
          { description: 'Initiate phototherapy if indicated', itemType: 'intervention' },
          { description: 'Monitor bilirubin Q8-12H', itemType: 'assessment' },
          { description: 'Eye protection in place', itemType: 'task' },
        ],
      },
      {
        name: 'Monitoring',
        tasks: [
          { description: 'Temperature monitoring', itemType: 'assessment' },
          { description: 'Adequate hydration', itemType: 'intervention' },
          { description: 'Skin assessment', itemType: 'assessment' },
        ],
      },
      {
        name: 'Discontinuation',
        tasks: [
          { description: 'Rebound bilirubin 12-24h post', itemType: 'task' },
          { description: 'Follow-up plan', itemType: 'task' },
        ],
      },
    ],
  },
  {
    id: 'hypoglycemia',
    name: 'Hypoglycemia',
    category: 'nutrition',
    description: 'Hypoglycemia management protocol',
    steps: 5,
    phases: [
      {
        name: 'Initial Management',
        tasks: [
          { description: 'Confirm glucose level', itemType: 'task' },
          { description: 'Assess clinical symptoms', itemType: 'assessment' },
          { description: 'Initiate treatment per severity', itemType: 'intervention' },
        ],
      },
      {
        name: 'Glucose Support',
        tasks: [
          { description: 'IV dextrose if symptomatic', itemType: 'intervention' },
          { description: 'Feeding support', itemType: 'intervention' },
          { description: 'Calculate GIR', itemType: 'assessment' },
        ],
      },
      {
        name: 'Monitoring',
        tasks: [
          { description: 'Serial glucose checks', itemType: 'assessment' },
          { description: 'Wean glucose support as tolerated', itemType: 'intervention' },
        ],
      },
    ],
  },
  {
    id: 'feeding',
    name: 'Feeding Advancement',
    category: 'nutrition',
    description: 'Standardized feeding advancement protocol',
    steps: 7,
    phases: [
      {
        name: 'Initiation',
        tasks: [
          { description: 'Start trophic feeds 10-20 mL/kg/day', itemType: 'intervention' },
          { description: 'Prefer maternal breast milk', itemType: 'intervention' },
        ],
      },
      {
        name: 'Advancement',
        tasks: [
          { description: 'Advance 20-30 mL/kg/day', itemType: 'intervention' },
          { description: 'Monitor for intolerance', itemType: 'assessment' },
          { description: 'Document residuals', itemType: 'assessment' },
        ],
      },
      {
        name: 'Fortification',
        tasks: [
          { description: 'Add fortifier at full feeds', itemType: 'intervention' },
          { description: 'Monitor growth parameters', itemType: 'assessment' },
        ],
      },
      {
        name: 'Oral Feeding',
        tasks: [
          { description: 'Assess oral feeding readiness', itemType: 'assessment' },
          { description: 'Start oral trials', itemType: 'intervention' },
          { description: 'Transition to ad lib feeds', itemType: 'intervention' },
        ],
      },
    ],
  },
  {
    id: 'pain',
    name: 'Pain Management',
    category: 'pain',
    description: 'Neonatal pain assessment and management',
    steps: 4,
    phases: [
      {
        name: 'Assessment',
        tasks: [
          { description: 'NIPS/PIPP score', itemType: 'assessment' },
          { description: 'Identify pain sources', itemType: 'assessment' },
        ],
      },
      {
        name: 'Non-Pharmacologic',
        tasks: [
          { description: 'Swaddling/containment', itemType: 'intervention' },
          { description: 'Non-nutritive sucking', itemType: 'intervention' },
          { description: 'Skin-to-skin care', itemType: 'intervention' },
        ],
      },
      {
        name: 'Pharmacologic',
        tasks: [
          { description: 'Sweet-ease for procedures', itemType: 'intervention' },
          { description: 'Morphine/fentanyl if indicated', itemType: 'intervention' },
        ],
      },
      {
        name: 'Reassessment',
        tasks: [
          { description: 'Reassess after intervention', itemType: 'assessment' },
          { description: 'Document effectiveness', itemType: 'task' },
        ],
      },
    ],
  },
  {
    id: 'discharge',
    name: 'Discharge Readiness',
    category: 'family',
    description: 'Discharge preparation checklist',
    steps: 10,
    phases: [
      {
        name: 'Medical Criteria',
        tasks: [
          { description: 'Temperature stable in open crib', itemType: 'assessment' },
          { description: 'Feeding well orally', itemType: 'assessment' },
          { description: 'Weight gain pattern established', itemType: 'assessment' },
          { description: 'No significant apnea/bradycardia', itemType: 'assessment' },
        ],
      },
      {
        name: 'Parent Education',
        tasks: [
          { description: 'Feeding teaching completed', itemType: 'education' },
          { description: 'CPR training', itemType: 'education' },
          { description: 'Safe sleep education', itemType: 'education' },
          { description: 'Signs of illness teaching', itemType: 'education' },
        ],
      },
      {
        name: 'Follow-up',
        tasks: [
          { description: 'PCP appointment scheduled', itemType: 'task' },
          { description: 'Specialty follow-up arranged', itemType: 'task' },
          { description: 'Early intervention referral if needed', itemType: 'task' },
        ],
      },
      {
        name: 'Documentation',
        tasks: [
          { description: 'Discharge summary completed', itemType: 'task' },
          { description: 'Prescriptions provided', itemType: 'task' },
          { description: 'Car seat test passed', itemType: 'assessment' },
        ],
      },
    ],
  },
];

// GET /api/care-plans/templates - Get protocol templates
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  // Filter templates by category if specified
  let templates = [...DEFAULT_TEMPLATES];

  if (category) {
    const validCategories = ['respiratory', 'nutrition', 'neuro', 'infection', 'growth', 'skin', 'family', 'pain', 'developmental'];
    if (validCategories.includes(category)) {
      templates = templates.filter(t => t.category === category);
    }
  }

  // Add computed total step count
  const enrichedTemplates = templates.map(t => ({
    ...t,
    totalTasks: t.phases.reduce((sum, phase) => sum + phase.tasks.length, 0),
  }));

  // Group by category
  const byCategory = enrichedTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {});

  logger.info('Fetched care plan templates', {
    userId: session.user.id,
    count: enrichedTemplates.length,
    category: category || 'all',
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: enrichedTemplates,
    meta: {
      total: enrichedTemplates.length,
      byCategory,
      categories: Object.keys(byCategory),
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/care-plans/templates/apply - Apply a template to create a care plan
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  requireRole(session, ['admin', 'physician', 'charge_nurse', 'staff_nurse']);

  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  const { templateId, patientId, customTitle, priority } = body;

  // Validation
  if (!templateId) {
    throw new ValidationError([{ field: 'templateId', message: 'Template ID is required' }]);
  }

  if (!patientId) {
    throw new ValidationError([{ field: 'patientId', message: 'Patient ID is required' }]);
  }

  const patientIdNum = parseInt(patientId);
  if (isNaN(patientIdNum)) {
    throw new ValidationError([{ field: 'patientId', message: 'Invalid patient ID' }]);
  }

  // Find template
  const template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    throw new ValidationError([{ field: 'templateId', message: 'Template not found' }]);
  }

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientIdNum },
  });

  if (!patient) {
    throw new ValidationError([{ field: 'patientId', message: 'Patient not found' }]);
  }

  // Maps for enum values
  const categoryMap = {
    'respiratory': 'RESPIRATORY',
    'nutrition': 'NUTRITION',
    'neuro': 'NEUROLOGICAL',
    'infection': 'INFECTION',
    'growth': 'GROWTH_DEVELOPMENT',
    'skin': 'SKIN_WOUND',
    'family': 'FAMILY_SUPPORT',
    'pain': 'PAIN_MANAGEMENT',
    'developmental': 'DEVELOPMENTAL',
    'discharge': 'DISCHARGE_PLANNING',
    'other': 'OTHER',
  };

  const priorityMap = {
    'high': 'HIGH',
    'medium': 'MEDIUM',
    'low': 'LOW',
  };

  const itemTypeMap = {
    'task': 'TASK',
    'assessment': 'ASSESSMENT',
    'intervention': 'INTERVENTION',
    'education': 'EDUCATION',
    'monitoring': 'MONITORING',
    'consultation': 'CONSULTATION',
  };

  const mappedCategory = categoryMap[template.category?.toLowerCase()] || 'OTHER';
  const mappedPriority = priorityMap[priority?.toLowerCase()] || 'MEDIUM';

  // Create care plan from template
  const carePlan = await prisma.$transaction(async (tx) => {
    // Create the care plan
    const plan = await tx.carePlan.create({
      data: {
        patientId: patientIdNum,
        createdById: parseInt(session.user.id),
        title: customTitle || template.name,
        category: mappedCategory,
        description: template.description,
        goals: JSON.stringify([`Complete ${template.name} protocol`]),
        priority: mappedPriority,
        status: 'ACTIVE',
      },
    });

    // Create all tasks from template phases
    const allTasks = [];
    for (const phase of template.phases) {
      for (const task of phase.tasks) {
        allTasks.push({
          carePlanId: plan.id,
          description: `[${phase.name}] ${task.description}`,
          itemType: itemTypeMap[task.itemType?.toLowerCase()] || 'TASK',
          status: 'PENDING',
        });
      }
    }

    if (allTasks.length > 0) {
      await tx.carePlanItem.createMany({
        data: allTasks,
      });
    }

    // Create audit log
    await tx.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'create_care_plan_from_template',
        resource: 'care_plan',
        resourceId: plan.id,
        details: JSON.stringify({
          templateId,
          templateName: template.name,
          patientId: patientIdNum,
          taskCount: allTasks.length,
        }),
      },
    });

    // Fetch complete plan with items
    return tx.carePlan.findUnique({
      where: { id: plan.id },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            initials: true,
            role: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });

  logger.audit('Care plan created from template', {
    userId: session.user.id,
    userName: session.user.name,
    carePlanId: carePlan.id,
    templateId,
    templateName: template.name,
    patientId: patientIdNum,
    taskCount: carePlan.items.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...carePlan,
      goals: carePlan.goals ? JSON.parse(carePlan.goals) : [],
    },
  }, { status: 201 });
});
