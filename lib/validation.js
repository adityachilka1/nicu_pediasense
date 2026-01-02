import { z } from 'zod';

// Common field schemas
export const schemas = {
  // Patient identifiers
  mrn: z.string()
    .min(1, 'MRN is required')
    .max(20, 'MRN must be 20 characters or less')
    .regex(/^[A-Za-z0-9-]+$/, 'MRN must be alphanumeric with hyphens only'),

  patientName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less')
    .regex(/^[A-Za-z\s,.'()-]+$/, 'Name contains invalid characters'),

  // Demographics
  gender: z.enum(['M', 'F', 'U'], {
    errorMap: () => ({ message: 'Gender must be M, F, or U' })
  }),

  dateOfBirth: z.string()
    .datetime({ message: 'Invalid date format' })
    .or(z.date()),

  gestationalAge: z.string()
    .regex(/^\d{2}\+\d$/, 'Gestational age must be in format XX+X (e.g., 32+4)')
    .optional()
    .nullable(),

  // Measurements (NICU-specific ranges)
  weight: z.number()
    .min(0.2, 'Weight must be at least 0.2 kg')
    .max(10, 'Weight must be 10 kg or less')
    .optional()
    .nullable(),

  // Vital signs
  heartRate: z.number()
    .int('Heart rate must be a whole number')
    .min(40, 'Heart rate too low')
    .max(250, 'Heart rate too high')
    .optional()
    .nullable(),

  spo2: z.number()
    .int('SpO2 must be a whole number')
    .min(0, 'SpO2 cannot be negative')
    .max(100, 'SpO2 cannot exceed 100%')
    .optional()
    .nullable(),

  respRate: z.number()
    .int('Respiratory rate must be a whole number')
    .min(0, 'Respiratory rate cannot be negative')
    .max(120, 'Respiratory rate too high')
    .optional()
    .nullable(),

  temperature: z.number()
    .min(25, 'Temperature too low')
    .max(45, 'Temperature too high')
    .optional()
    .nullable(),

  fio2: z.number()
    .int('FiO2 must be a whole number')
    .min(21, 'FiO2 must be at least 21%')
    .max(100, 'FiO2 cannot exceed 100%')
    .optional()
    .nullable(),

  // Bed
  bedNumber: z.string()
    .regex(/^\d{2}$/, 'Bed number must be 2 digits')
    .optional()
    .nullable(),

  // Status
  patientStatus: z.enum(['normal', 'warning', 'critical', 'discharged'], {
    errorMap: () => ({ message: 'Invalid patient status' })
  }),

  alarmStatus: z.enum(['active', 'acknowledged', 'silenced', 'resolved'], {
    errorMap: () => ({ message: 'Invalid alarm status' })
  }),

  alarmType: z.enum(['critical', 'warning', 'advisory'], {
    errorMap: () => ({ message: 'Invalid alarm type' })
  }),

  // IDs
  id: z.number().int().positive('ID must be a positive integer'),
  idString: z.string().regex(/^\d+$/, 'ID must be numeric'),
};

// Request body schemas
export const createPatientSchema = z.object({
  mrn: schemas.mrn,
  name: schemas.patientName,
  dateOfBirth: schemas.dateOfBirth,
  gender: schemas.gender,
  gestationalAge: schemas.gestationalAge,
  birthWeight: schemas.weight,
  currentWeight: schemas.weight,
  bedNumber: schemas.bedNumber,
  alarmLimits: z.object({
    spo2: z.tuple([z.number(), z.number()]).optional(),
    pr: z.tuple([z.number(), z.number()]).optional(),
    rr: z.tuple([z.number(), z.number()]).optional(),
    temp: z.tuple([z.number(), z.number()]).optional(),
  }).optional().nullable(),
});

export const updatePatientSchema = z.object({
  name: schemas.patientName.optional(),
  currentWeight: schemas.weight,
  dayOfLife: z.number().int().min(1).max(365).optional(),
  status: schemas.patientStatus.optional(),
  bedNumber: schemas.bedNumber,
  alarmLimits: z.object({
    spo2: z.tuple([z.number(), z.number()]).optional(),
    pr: z.tuple([z.number(), z.number()]).optional(),
    rr: z.tuple([z.number(), z.number()]).optional(),
    temp: z.tuple([z.number(), z.number()]).optional(),
  }).optional().nullable(),
}).partial();

export const createVitalsSchema = z.object({
  heartRate: schemas.heartRate,
  spo2: schemas.spo2,
  respRate: schemas.respRate,
  temperature: schemas.temperature,
  fio2: schemas.fio2,
  pi: z.number().min(0).max(20).optional().nullable(),
  source: z.enum(['monitor', 'manual', 'device', 'simulator']).default('manual'),
});

export const alarmActionSchema = z.object({
  action: z.enum(['acknowledge', 'silence', 'resolve'], {
    errorMap: () => ({ message: 'Action must be acknowledge, silence, or resolve' })
  }),
  alarmIds: z.array(z.number().int().positive()).min(1, 'At least one alarm ID required'),
  silenceDuration: z.number().int().min(30).max(600).default(120),
});

// Strong password validation for login (checks format only, not against common passwords)
export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .transform(val => val.toLowerCase().trim()),
  password: z.string()
    .min(1, 'Password is required')
    .max(100, 'Password too long'),
});

// Strong password validation for registration/password change
// Enforces: 12+ chars, uppercase, lowercase, number, special character
export const strongPasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character')
  .refine(
    (password) => {
      const commonPatterns = [
        'password', 'admin123', 'doctor123', 'nurse123', 'hospital',
        'qwerty', '123456', 'letmein', 'welcome', 'password1', 'abc123'
      ];
      return !commonPatterns.some(pattern => password.toLowerCase().includes(pattern));
    },
    { message: 'Password contains a commonly used pattern' }
  );

// User registration schema with strong password
export const registerUserSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .transform(val => val.toLowerCase().trim()),
  password: strongPasswordSchema,
  confirmPassword: z.string(),
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long'),
  role: z.enum(['admin', 'physician', 'charge_nurse', 'staff_nurse', 'administrative']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Password change schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPasswordSchema,
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'New passwords do not match',
  path: ['confirmNewPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

// =====================================================
// DEVICE SCHEMAS
// =====================================================

export const deviceTypes = [
  'monitor',
  'ventilator',
  'infusion_pump',
  'phototherapy',
  'cpap',
  'incubator',
  'pulse_oximeter',
  'ecg',
  'blood_gas_analyzer',
  'feeding_pump',
  'bili_meter',
  'temperature_probe',
];

export const deviceStatuses = [
  'active',
  'inactive',
  'maintenance',
  'offline',
  'error',
];

export const createDeviceSchema = z.object({
  serialNumber: z.string()
    .min(1, 'Serial number is required')
    .max(100, 'Serial number too long')
    .regex(/^[A-Za-z0-9-_]+$/, 'Serial number must be alphanumeric with hyphens/underscores'),
  name: z.string()
    .min(1, 'Device name is required')
    .max(200, 'Device name too long'),
  type: z.enum(deviceTypes, {
    errorMap: () => ({ message: 'Invalid device type' })
  }),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  bedId: z.number().int().positive().optional().nullable(),
  status: z.enum(deviceStatuses).default('active'),
  firmwareVersion: z.string().max(50).optional().nullable(),
  config: z.object({
    ip: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IP address').optional(),
    port: z.number().int().min(1).max(65535).optional(),
    protocol: z.enum(['hl7', 'fhir', 'proprietary', 'serial', 'tcp', 'mqtt']).optional(),
    settings: z.record(z.any()).optional(),
  }).optional().nullable(),
  lastCalibration: z.string().datetime().optional().nullable(),
  nextCalibration: z.string().datetime().optional().nullable(),
  lastMaintenance: z.string().datetime().optional().nullable(),
  nextMaintenance: z.string().datetime().optional().nullable(),
});

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(deviceTypes).optional(),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  bedId: z.number().int().positive().optional().nullable(),
  status: z.enum(deviceStatuses).optional(),
  firmwareVersion: z.string().max(50).optional().nullable(),
  config: z.object({
    ip: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IP address').optional(),
    port: z.number().int().min(1).max(65535).optional(),
    protocol: z.enum(['hl7', 'fhir', 'proprietary', 'serial', 'tcp', 'mqtt']).optional(),
    settings: z.record(z.any()).optional(),
  }).optional().nullable(),
  lastCalibration: z.string().datetime().optional().nullable(),
  nextCalibration: z.string().datetime().optional().nullable(),
  lastMaintenance: z.string().datetime().optional().nullable(),
  nextMaintenance: z.string().datetime().optional().nullable(),
}).partial();

// =====================================================
// DEVICE LOG SCHEMAS
// =====================================================

export const deviceLogLevels = ['info', 'warning', 'error', 'critical'];

export const deviceLogCategories = [
  'status_change',
  'calibration',
  'maintenance',
  'error',
  'alert',
  'connection',
  'data_transmission',
  'configuration',
  'firmware_update',
];

export const createDeviceLogSchema = z.object({
  level: z.enum(deviceLogLevels).default('info'),
  category: z.enum(deviceLogCategories, {
    errorMap: () => ({ message: 'Invalid log category' })
  }),
  message: z.string()
    .min(1, 'Message is required')
    .max(1000, 'Message too long'),
  details: z.record(z.any()).optional().nullable(),
});

// =====================================================
// ALARM LIMIT SCHEMAS
// =====================================================

export const alarmLimitSchema = z.object({
  spo2: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]).optional(),
  pr: z.tuple([z.number().min(0).max(300), z.number().min(0).max(300)]).optional(),
  rr: z.tuple([z.number().min(0).max(150), z.number().min(0).max(150)]).optional(),
  temp: z.tuple([z.number().min(25).max(45), z.number().min(25).max(45)]).optional(),
  fio2: z.tuple([z.number().min(21).max(100), z.number().min(21).max(100)]).optional(),
  pi: z.tuple([z.number().min(0).max(20), z.number().min(0).max(20)]).optional(),
  bpSystolic: z.tuple([z.number().min(0).max(200), z.number().min(0).max(200)]).optional(),
  bpDiastolic: z.tuple([z.number().min(0).max(150), z.number().min(0).max(150)]).optional(),
  bpMean: z.tuple([z.number().min(0).max(150), z.number().min(0).max(150)]).optional(),
});

export const updateAlarmLimitsSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  limits: alarmLimitSchema,
  presetId: z.number().int().positive().optional().nullable(),
});

export const alarmPresetNames = [
  'preterm_24_28',
  'preterm_28_32',
  'preterm_32_37',
  'term',
  'custom',
];

// =====================================================
// MEDICAL ORDER SCHEMAS
// =====================================================

export const orderCategories = [
  'medication',
  'lab',
  'imaging',
  'diet',
  'nursing',
  'respiratory',
  'procedure',
];

export const orderTypes = [
  'one_time',
  'recurring',
  'prn',
  'continuous',
];

export const orderPriorities = [
  'stat',
  'urgent',
  'routine',
  'scheduled',
];

export const orderStatuses = [
  'pending',
  'active',
  'completed',
  'discontinued',
  'cancelled',
];

export const createOrderSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  category: z.enum(orderCategories, {
    errorMap: () => ({ message: 'Invalid order category' })
  }),
  orderType: z.enum(orderTypes, {
    errorMap: () => ({ message: 'Invalid order type' })
  }),
  priority: z.enum(orderPriorities).default('routine'),
  orderSetId: z.number().int().positive().optional().nullable(),
  name: z.string()
    .min(1, 'Order name is required')
    .max(500, 'Order name too long'),
  details: z.record(z.any()).optional().nullable(),
  instructions: z.string().max(2000).optional().nullable(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
});

export const updateOrderSchema = z.object({
  status: z.enum(orderStatuses).optional(),
  discontinueReason: z.string().max(500).optional().nullable(),
  instructions: z.string().max(2000).optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
}).partial();

// =====================================================
// CARE PLAN SCHEMAS
// =====================================================

export const carePlanCategories = [
  'respiratory',
  'nutrition',
  'neuro',
  'infection',
  'growth',
  'skin',
  'family',
  'pain',
  'developmental',
];

export const carePlanPriorities = ['high', 'medium', 'low'];

export const carePlanStatuses = ['active', 'on_hold', 'completed', 'discontinued'];

export const carePlanItemTypes = ['task', 'assessment', 'intervention', 'education'];

export const carePlanItemStatuses = ['pending', 'in_progress', 'completed', 'skipped'];

export const createCarePlanSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title too long'),
  category: z.enum(carePlanCategories, {
    errorMap: () => ({ message: 'Invalid care plan category' })
  }),
  description: z.string().max(2000).optional().nullable(),
  goals: z.array(z.string()).optional().nullable(),
  priority: z.enum(carePlanPriorities).default('medium'),
  targetDate: z.string().datetime().optional().nullable(),
  items: z.array(z.object({
    description: z.string().min(1).max(500),
    itemType: z.enum(carePlanItemTypes).default('task'),
    frequency: z.enum(['once', 'daily', 'weekly', 'prn']).optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
  })).optional(),
});

export const updateCarePlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  goals: z.array(z.string()).optional().nullable(),
  priority: z.enum(carePlanPriorities).optional(),
  status: z.enum(carePlanStatuses).optional(),
  targetDate: z.string().datetime().optional().nullable(),
}).partial();

export const updateCarePlanItemSchema = z.object({
  status: z.enum(carePlanItemStatuses),
  notes: z.string().max(1000).optional().nullable(),
});

// =====================================================
// DISCHARGE SCHEMAS
// =====================================================

export const dischargeDispositions = ['home', 'transfer', 'hospice', 'deceased'];

export const dischargeStatuses = ['planning', 'ready', 'pending_approval', 'discharged', 'cancelled'];

export const checklistCategories = ['medical', 'equipment', 'education', 'followup', 'documentation', 'safety'];

export const checklistItemStatuses = ['pending', 'in_progress', 'completed', 'not_applicable'];

export const createDischargePlanSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  estimatedDate: z.string().datetime().optional().nullable(),
  disposition: z.enum(dischargeDispositions).optional().nullable(),
  primaryCaregiver: z.string().max(200).optional().nullable(),
  caregiverPhone: z.string().max(20).optional().nullable(),
  specialInstructions: z.string().max(2000).optional().nullable(),
  followUpPlan: z.string().max(2000).optional().nullable(),
  checklistItems: z.array(z.object({
    category: z.enum(checklistCategories),
    description: z.string().min(1).max(500),
    required: z.boolean().default(true),
    orderIndex: z.number().int().min(0).default(0),
  })).optional(),
});

export const updateDischargePlanSchema = z.object({
  estimatedDate: z.string().datetime().optional().nullable(),
  actualDate: z.string().datetime().optional().nullable(),
  disposition: z.enum(dischargeDispositions).optional().nullable(),
  primaryCaregiver: z.string().max(200).optional().nullable(),
  caregiverPhone: z.string().max(20).optional().nullable(),
  status: z.enum(dischargeStatuses).optional(),
  readinessScore: z.number().int().min(0).max(100).optional().nullable(),
  specialInstructions: z.string().max(2000).optional().nullable(),
  followUpPlan: z.string().max(2000).optional().nullable(),
}).partial();

export const updateChecklistItemSchema = z.object({
  status: z.enum(checklistItemStatuses),
  notes: z.string().max(1000).optional().nullable(),
});

// =====================================================
// HANDOFF SCHEMAS
// =====================================================

export const shiftTypes = ['day', 'evening', 'night'];

export const handoffStatuses = ['draft', 'submitted', 'acknowledged'];

export const acuityLevels = ['stable', 'moderate', 'critical'];

export const createHandoffNoteSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  shift: z.enum(shiftTypes, {
    errorMap: () => ({ message: 'Invalid shift type' })
  }),
  shiftDate: z.string().datetime(),
  situation: z.string().max(2000).optional().nullable(),
  background: z.string().max(2000).optional().nullable(),
  assessment: z.string().max(2000).optional().nullable(),
  recommendation: z.string().max(2000).optional().nullable(),
  acuity: z.enum(acuityLevels).optional().nullable(),
  keyEvents: z.array(z.string()).optional().nullable(),
  pendingTasks: z.array(z.string()).optional().nullable(),
  alertsFlags: z.array(z.string()).optional().nullable(),
  status: z.enum(handoffStatuses).default('draft'),
});

export const updateHandoffNoteSchema = z.object({
  situation: z.string().max(2000).optional().nullable(),
  background: z.string().max(2000).optional().nullable(),
  assessment: z.string().max(2000).optional().nullable(),
  recommendation: z.string().max(2000).optional().nullable(),
  acuity: z.enum(acuityLevels).optional().nullable(),
  keyEvents: z.array(z.string()).optional().nullable(),
  pendingTasks: z.array(z.string()).optional().nullable(),
  alertsFlags: z.array(z.string()).optional().nullable(),
  status: z.enum(handoffStatuses).optional(),
}).partial();

// =====================================================
// GROWTH MEASUREMENT SCHEMAS
// =====================================================

// Schema for creating growth measurement (grams for weight in frontend, converted to kg in API)
export const createGrowthMeasurementSchema = z.object({
  patientId: z.number().int().positive('Patient ID must be a positive integer'),
  // Weight in kg (0.1 - 15 kg range for NICU)
  weight: z.number()
    .min(0.1, 'Weight must be at least 0.1 kg (100g)')
    .max(15, 'Weight must be 15 kg or less')
    .optional()
    .nullable(),
  // Length in cm
  length: z.number()
    .min(20, 'Length must be at least 20 cm')
    .max(80, 'Length must be 80 cm or less')
    .optional()
    .nullable(),
  // Head circumference in cm
  headCirc: z.number()
    .min(15, 'Head circumference must be at least 15 cm')
    .max(50, 'Head circumference must be 50 cm or less')
    .optional()
    .nullable(),
  // Optional percentiles (will be calculated by API if not provided)
  weightPercentile: z.number().min(0).max(100).optional().nullable(),
  lengthPercentile: z.number().min(0).max(100).optional().nullable(),
  headCircPercentile: z.number().min(0).max(100).optional().nullable(),
  // Metadata
  measuredBy: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  measuredAt: z.string().datetime().optional(),
}).refine(
  data => data.weight !== null || data.length !== null || data.headCirc !== null,
  { message: 'At least one measurement (weight, length, or head circumference) is required' }
);

// Schema for frontend input (weight in grams, converted to kg before API call)
export const growthMeasurementInputSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  date: z.string().min(1, 'Date is required'),
  // Weight in grams for user input
  weight: z.union([
    z.string().transform(val => val === '' ? null : parseFloat(val) / 1000), // Convert g to kg
    z.number().transform(val => val / 1000),
  ]).optional().nullable(),
  // Length in cm
  length: z.union([
    z.string().transform(val => val === '' ? null : parseFloat(val)),
    z.number(),
  ]).optional().nullable(),
  // Head circumference in cm
  hc: z.union([
    z.string().transform(val => val === '' ? null : parseFloat(val)),
    z.number(),
  ]).optional().nullable(),
}).refine(
  data => {
    const hasWeight = data.weight !== null && data.weight !== undefined && data.weight !== '';
    const hasLength = data.length !== null && data.length !== undefined && data.length !== '';
    const hasHC = data.hc !== null && data.hc !== undefined && data.hc !== '';
    return hasWeight || hasLength || hasHC;
  },
  { message: 'At least one measurement is required' }
);

// =====================================================
// FAMILY PORTAL SCHEMAS
// =====================================================

export const messageTypes = ['general', 'update', 'question', 'response', 'alert', 'education'];
export const messageStatuses = ['pending', 'sent', 'delivered', 'read', 'failed'];
export const messageChannels = ['app', 'email', 'sms'];

export const createFamilyMessageSchema = z.object({
  familyContactId: z.number().int().positive('Family contact ID is required'),
  subject: z.string().max(200).optional().nullable(),
  content: z.string()
    .min(1, 'Message content is required')
    .max(5000, 'Message too long'),
  messageType: z.enum(messageTypes).default('general'),
  channel: z.enum(messageChannels).default('app'),
});

export const milestoneTypes = [
  'first_breath',
  'off_oxygen',
  'first_feed',
  'first_bottle',
  'first_breastfeed',
  'kangaroo_care',
  'weight_gain',
  'phototherapy_complete',
  'extubation',
  'discharge_ready',
  'custom',
];

export const createMilestoneSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  event: z.string()
    .min(1, 'Event description is required')
    .max(500, 'Event description too long'),
  milestoneType: z.enum(milestoneTypes).default('custom'),
  date: z.string().datetime(),
  shared: z.boolean().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateMilestoneSchema = z.object({
  event: z.string().min(1).max(500).optional(),
  shared: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
}).partial();

// =====================================================
// MILESTONE MODEL (for storing milestones - add to Prisma later)
// =====================================================

export const educationCategories = [
  'feeding',
  'developmental_care',
  'discharge_prep',
  'general_nicu',
  'kangaroo_care',
  'equipment',
  'safety',
  'bonding',
  'nutrition',
  'medical_conditions',
];

export const educationContentTypes = ['article', 'video', 'checklist', 'faq', 'pdf'];

// Validation helper function
export function validateRequest(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Zod uses .issues not .errors
    const errors = (result.error?.issues || result.error?.errors || []).map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

// Middleware-style validator for API routes
export function createValidator(schema) {
  return async (data) => {
    const result = validateRequest(schema, data);
    if (!result.success) {
      throw new ValidationError(result.errors);
    }
    return result.data;
  };
}

// Custom validation error
export class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }
}
