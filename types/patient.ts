/**
 * NICU Dashboard - Patient Type Definitions
 */

import type { PatientStatus, Gender, BedStatus } from './enums';
import type { Vital, LatestVitals } from './vital';
import type { Alarm, AlarmSummary } from './alarm';

/**
 * Alarm limits configuration for a patient
 */
export interface AlarmLimits {
  spo2?: [number, number]; // [min, max]
  pr?: [number, number]; // Pulse rate
  rr?: [number, number]; // Respiratory rate
  temp?: [number, number]; // Temperature
  fio2?: [number, number];
  pi?: [number, number]; // Perfusion index
  bp_systolic?: [number, number];
  bp_diastolic?: [number, number];
  bp_mean?: [number, number];
}

/**
 * Bed assignment
 */
export interface Bed {
  id: number;
  bedNumber: string;
  unit: string;
  status: BedStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Base patient type
 */
export interface Patient {
  id: number;
  mrn: string;
  name: string;
  dateOfBirth: Date;
  gender: Gender;
  gestationalAge: string | null;
  birthWeight: number | null;
  currentWeight: number | null;
  dayOfLife: number;
  bedId: number | null;
  status: PatientStatus;
  admitDate: Date;
  dischargeDate: Date | null;
  alarmLimits: string | null; // JSON string
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Patient with parsed alarm limits
 */
export interface PatientWithAlarmLimits extends Omit<Patient, 'alarmLimits'> {
  alarmLimits: AlarmLimits | null;
}

/**
 * Patient with bed relation
 */
export interface PatientWithBed extends Patient {
  bed: Bed | null;
}

/**
 * Patient with latest vitals (for dashboard display)
 */
export interface PatientWithVitals extends PatientWithBed {
  latestVitals: LatestVitals | null;
  activeAlarms: AlarmSummary[];
}

/**
 * Patient with full relations
 */
export interface PatientWithRelations extends PatientWithBed {
  vitals?: Vital[];
  alarms?: Alarm[];
  activeAlarmCount?: number;
}

/**
 * Patient list item (optimized for list views)
 */
export interface PatientListItem {
  id: number;
  mrn: string;
  name: string;
  bedNumber: string | null;
  status: PatientStatus;
  dayOfLife: number;
  gestationalAge: string | null;
  currentWeight: number | null;
  activeAlarmCount: number;
}

/**
 * Patient creation request
 */
export interface CreatePatientRequest {
  mrn: string;
  name: string;
  dateOfBirth: string; // ISO date string
  gender: Gender;
  gestationalAge?: string;
  birthWeight?: number;
  currentWeight?: number;
  bedId?: number;
  alarmLimits?: AlarmLimits;
}

/**
 * Patient update request
 */
export interface UpdatePatientRequest {
  name?: string;
  dateOfBirth?: string;
  gender?: Gender;
  gestationalAge?: string;
  birthWeight?: number;
  currentWeight?: number;
  dayOfLife?: number;
  bedId?: number | null;
  status?: PatientStatus;
  alarmLimits?: AlarmLimits;
}

/**
 * Patient admission request
 */
export interface AdmitPatientRequest {
  mrn: string;
  name: string;
  dateOfBirth: string;
  gender: Gender;
  gestationalAge?: string;
  birthWeight?: number;
  currentWeight?: number;
  bedId?: number;
  admitDate?: string;
  alarmLimits?: AlarmLimits;
}

/**
 * Patient discharge request
 */
export interface DischargePatientRequest {
  dischargeDate?: string;
  dischargeNotes?: string;
}

/**
 * Patient transfer request (change bed)
 */
export interface TransferPatientRequest {
  newBedId: number;
  transferNotes?: string;
}

/**
 * Patient search filters
 */
export interface PatientSearchFilters {
  query?: string; // Search by name or MRN
  status?: PatientStatus | PatientStatus[];
  bedId?: number;
  unit?: string;
  minDayOfLife?: number;
  maxDayOfLife?: number;
  hasActiveAlarms?: boolean;
}

/**
 * Patient dashboard summary
 */
export interface PatientDashboardSummary {
  totalPatients: number;
  criticalPatients: number;
  warningPatients: number;
  normalPatients: number;
  dischargedToday: number;
  admittedToday: number;
  availableBeds: number;
  totalBeds: number;
}

/**
 * Patient census by unit
 */
export interface PatientCensus {
  unit: string;
  total: number;
  occupied: number;
  available: number;
  critical: number;
  warning: number;
  normal: number;
}

/**
 * Gestational age breakdown
 */
export interface GestationalAgeInfo {
  weeks: number;
  days: number;
  formatted: string; // e.g., "32+4"
  category: 'extremely_preterm' | 'very_preterm' | 'moderate_preterm' | 'late_preterm' | 'term';
}

/**
 * Parse gestational age string to structured info
 */
export function parseGestationalAge(ga: string | null): GestationalAgeInfo | null {
  if (!ga) return null;

  const match = ga.match(/(\d+)\+(\d+)/);
  if (!match) return null;

  const weeks = parseInt(match[1] as string, 10);
  const days = parseInt(match[2] as string, 10);

  let category: GestationalAgeInfo['category'];
  if (weeks < 28) category = 'extremely_preterm';
  else if (weeks < 32) category = 'very_preterm';
  else if (weeks < 34) category = 'moderate_preterm';
  else if (weeks < 37) category = 'late_preterm';
  else category = 'term';

  return {
    weeks,
    days,
    formatted: ga,
    category,
  };
}
