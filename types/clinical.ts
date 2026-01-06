/**
 * NICU Dashboard - Clinical Workflow Type Definitions
 *
 * Types for Orders, Care Plans, Discharge Planning, Handoffs, and other clinical workflows.
 */

import {
  OrderCategory,
  OrderType,
  OrderPriority,
  OrderStatus,
  CarePlanCategory,
  CarePlanStatus,
  CarePlanPriority,
  CarePlanItemType,
  CarePlanItemStatus,
  DischargeDisposition,
  DischargeStatus,
  DischargeChecklistCategory,
  DischargeChecklistStatus,
  Shift,
  HandoffStatus,
  PatientAcuity,
  MilestoneType,
  FeedingType,
  FeedingRoute,
  FeedingTolerance,
} from './enums';

// =====================================================
// MEDICAL ORDERS
// =====================================================

/**
 * Medical order
 */
export interface Order {
  id: number;
  patientId: number;
  orderingId: number;
  category: OrderCategory;
  orderType: OrderType;
  priority: OrderPriority;
  orderSetId: number | null;
  name: string;
  details: string | null;
  instructions: string | null;
  indication: string | null;
  medication: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  specimenType: string | null;
  studyType: string | null;
  status: OrderStatus;
  startTime: Date | null;
  endTime: Date | null;
  scheduledTime: Date | null;
  verifiedAt: Date | null;
  verifiedById: number | null;
  completedAt: Date | null;
  completedById: number | null;
  discontinuedAt: Date | null;
  discontinuedById: number | null;
  discontinueReason: string | null;
  criticalAlert: string | null;
  requiresApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

/**
 * Order with relations
 */
export interface OrderWithRelations extends Order {
  patient?: { id: number; name: string; mrn: string };
  ordering?: { id: number; fullName: string; initials: string | null };
  results?: OrderResult[];
  orderSet?: OrderSet;
}

/**
 * Order result (lab/imaging)
 */
export interface OrderResult {
  id: number;
  orderId: number;
  resultType: string;
  value: string | null;
  unit: string | null;
  referenceRange: string | null;
  interpretation: string | null;
  testName: string | null;
  specimen: string | null;
  findings: string | null;
  impression: string | null;
  resultedAt: Date | null;
  resultedBy: string | null;
  reviewedAt: Date | null;
  reviewedById: number | null;
  isCritical: boolean;
  isAbnormal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order set (template)
 */
export interface OrderSet {
  id: number;
  name: string;
  description: string | null;
  category: string;
  items: string; // JSON array
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create order request
 */
export interface CreateOrderRequest {
  patientId: number;
  category: OrderCategory;
  orderType: OrderType;
  priority?: OrderPriority;
  name: string;
  details?: string;
  instructions?: string;
  indication?: string;
  medication?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  specimenType?: string;
  studyType?: string;
  scheduledTime?: string;
  orderSetId?: number;
}

// =====================================================
// CARE PLANS
// =====================================================

/**
 * Care plan
 */
export interface CarePlan {
  id: number;
  patientId: number;
  createdById: number;
  title: string;
  category: CarePlanCategory;
  description: string | null;
  goals: string | null; // JSON array
  priority: CarePlanPriority;
  protocolId: string | null;
  protocolName: string | null;
  currentPhase: number;
  totalPhases: number;
  status: CarePlanStatus;
  startDate: Date;
  targetDate: Date | null;
  completedAt: Date | null;
  reviewDate: Date | null;
  progressPercent: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Care plan with relations
 */
export interface CarePlanWithRelations extends CarePlan {
  patient?: { id: number; name: string; mrn: string };
  createdBy?: { id: number; fullName: string; initials: string | null };
  items?: CarePlanItem[];
}

/**
 * Care plan item
 */
export interface CarePlanItem {
  id: number;
  carePlanId: number;
  description: string;
  itemType: CarePlanItemType;
  frequency: string | null;
  dueDate: Date | null;
  orderIndex: number;
  assignedToId: number | null;
  status: CarePlanItemStatus;
  completedAt: Date | null;
  completedById: number | null;
  notes: string | null;
  outcome: string | null;
  evidence: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create care plan request
 */
export interface CreateCarePlanRequest {
  patientId: number;
  title: string;
  category: CarePlanCategory;
  description?: string;
  goals?: string[];
  priority?: CarePlanPriority;
  targetDate?: string;
  items?: CreateCarePlanItemRequest[];
}

/**
 * Create care plan item request
 */
export interface CreateCarePlanItemRequest {
  description: string;
  itemType?: CarePlanItemType;
  frequency?: string;
  dueDate?: string;
  assignedToId?: number;
}

// =====================================================
// DISCHARGE PLANNING
// =====================================================

/**
 * Discharge plan
 */
export interface DischargePlan {
  id: number;
  patientId: number;
  createdById: number;
  estimatedDate: Date | null;
  actualDate: Date | null;
  disposition: DischargeDisposition | null;
  primaryCaregiver: string | null;
  caregiverPhone: string | null;
  caregiverEmail: string | null;
  homeEnvironment: string | null;
  transportationPlan: string | null;
  equipmentNeeds: string | null; // JSON array
  status: DischargeStatus;
  readinessScore: number | null;
  physiologicStable: boolean;
  feedingCompetent: boolean;
  familyEducated: boolean;
  followUpArranged: boolean;
  carSeatTested: boolean;
  hearingScreened: boolean;
  specialInstructions: string | null;
  followUpPlan: string | null;
  medicationsPrescribed: string | null; // JSON array
  dischargeInstructions: string | null;
  approvedById: number | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Discharge plan with relations
 */
export interface DischargePlanWithRelations extends DischargePlan {
  patient?: { id: number; name: string; mrn: string };
  createdBy?: { id: number; fullName: string };
  checklistItems?: DischargeChecklistItem[];
}

/**
 * Discharge checklist item
 */
export interface DischargeChecklistItem {
  id: number;
  dischargePlanId: number;
  category: DischargeChecklistCategory;
  description: string;
  required: boolean;
  orderIndex: number;
  aapStandard: string | null;
  aapCriterion: string | null;
  status: DischargeChecklistStatus;
  completedAt: Date | null;
  completedById: number | null;
  completedBy: string | null;
  notes: string | null;
  verifiedAt: Date | null;
  verifiedById: number | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// SHIFT HANDOFF
// =====================================================

/**
 * Handoff note (SBAR format)
 */
export interface HandoffNote {
  id: number;
  patientId: number;
  authorId: number;
  shift: Shift;
  shiftDate: Date;
  situation: string | null;
  background: string | null;
  assessment: string | null;
  recommendation: string | null;
  acuity: PatientAcuity | null;
  keyEvents: string | null; // JSON array
  pendingTasks: string | null; // JSON array
  alertsFlags: string | null; // JSON array
  codeStatus: string | null;
  isolation: string | null;
  allergies: string | null;
  status: HandoffStatus;
  acknowledgedAt: Date | null;
  acknowledgedById: number | null;
  acknowledgedNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Handoff note with relations
 */
export interface HandoffNoteWithRelations extends HandoffNote {
  patient?: { id: number; name: string; mrn: string; bedNumber: string | null };
  author?: { id: number; fullName: string; initials: string | null };
  acknowledgedBy?: { id: number; fullName: string };
}

/**
 * Create handoff request
 */
export interface CreateHandoffRequest {
  patientId: number;
  shift: Shift;
  shiftDate: string;
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
  acuity?: PatientAcuity;
  keyEvents?: string[];
  pendingTasks?: string[];
  alertsFlags?: string[];
  codeStatus?: string;
  isolation?: string;
  allergies?: string;
}

// =====================================================
// FEEDING & NUTRITION
// =====================================================

/**
 * Feeding log entry
 */
export interface FeedingLog {
  id: number;
  patientId: number;
  feedingType: FeedingType;
  route: FeedingRoute;
  volumeOrdered: number | null;
  volumeGiven: number | null;
  volumeResidual: number | null;
  residualColor: string | null;
  residualDisposition: string | null;
  tpnRate: number | null;
  tpnVolume: number | null;
  lipidRate: number | null;
  lipidVolume: number | null;
  dextroseConcentration: number | null;
  aminoAcidConcentration: number | null;
  tolerance: FeedingTolerance | null;
  emesis: boolean;
  emesisAmount: number | null;
  emesisCharacter: string | null;
  abdominalDistension: boolean;
  stoolPassed: boolean;
  fortified: boolean;
  fortifierAmount: number | null;
  calories: number | null;
  protein: number | null;
  breastMilkSource: string | null;
  breastMilkBatchId: string | null;
  expressed: boolean | null;
  feedingDuration: number | null;
  scheduledTime: Date | null;
  actualTime: Date | null;
  notes: string | null;
  recordedBy: string | null;
  verifiedBy: string | null;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create feeding log request
 */
export interface CreateFeedingLogRequest {
  patientId: number;
  feedingType: FeedingType;
  route: FeedingRoute;
  volumeOrdered?: number;
  volumeGiven?: number;
  volumeResidual?: number;
  residualColor?: string;
  residualDisposition?: string;
  tolerance?: FeedingTolerance;
  notes?: string;
}

// =====================================================
// GROWTH MEASUREMENTS
// =====================================================

/**
 * Growth measurement
 */
export interface GrowthMeasurement {
  id: number;
  patientId: number;
  weight: number | null;
  length: number | null;
  headCirc: number | null;
  abdominalCirc: number | null;
  chestCirc: number | null;
  weightChange: number | null;
  weightChangePercent: number | null;
  weightPercentile: number | null;
  lengthPercentile: number | null;
  headCircPercentile: number | null;
  weightZScore: number | null;
  lengthZScore: number | null;
  headCircZScore: number | null;
  velocityGrams: number | null;
  correctedAge: string | null;
  measurementType: string;
  measuredBy: string | null;
  verifiedBy: string | null;
  notes: string | null;
  measuredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create growth measurement request
 */
export interface CreateGrowthMeasurementRequest {
  patientId: number;
  weight?: number;
  length?: number;
  headCirc?: number;
  measurementType?: string;
  notes?: string;
}

// =====================================================
// MILESTONES
// =====================================================

/**
 * Patient milestone
 */
export interface Milestone {
  id: number;
  patientId: number;
  createdById: number;
  event: string;
  milestoneType: MilestoneType;
  date: Date;
  dayOfLife: number | null;
  correctedAge: string | null;
  shared: boolean;
  sharedAt: Date | null;
  sharedById: number | null;
  notes: string | null;
  photoAttached: boolean;
  photoPath: string | null;
  isSignificant: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create milestone request
 */
export interface CreateMilestoneRequest {
  patientId: number;
  event: string;
  milestoneType?: MilestoneType;
  date: string;
  notes?: string;
  isSignificant?: boolean;
}

// =====================================================
// FLOWSHEET
// =====================================================

/**
 * Flowsheet entry (hourly I/O)
 */
export interface FlowsheetEntry {
  id: number;
  patientId: number;
  shiftDate: Date;
  hour: number;
  ivFluids: number | null;
  tpn: number | null;
  lipids: number | null;
  bloodProducts: number | null;
  medications: number | null;
  enteral: number | null;
  oral: number | null;
  urine: number | null;
  stool: number | null;
  emesis: number | null;
  gastricOutput: number | null;
  ostomyOutput: number | null;
  drainOutput: number | null;
  bloodLoss: number | null;
  insensibleLoss: number | null;
  totalIntake: number | null;
  totalOutput: number | null;
  netBalance: number | null;
  stoolCount: number | null;
  stoolType: string | null;
  stoolColor: string | null;
  guaiacTest: string | null;
  urineCount: number | null;
  urineColor: string | null;
  specificGravity: number | null;
  temperature: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  spo2: number | null;
  fio2: number | null;
  ventilatorMode: string | null;
  peep: number | null;
  pip: number | null;
  rate: number | null;
  painScore: number | null;
  sedationScore: number | null;
  turnedRepositioned: boolean;
  skinAssessment: string | null;
  notes: string | null;
  recordedBy: string | null;
  verifiedBy: string | null;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
