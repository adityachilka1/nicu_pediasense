/**
 * NICU Dashboard - Alarm Type Definitions
 */

import type { AlarmType, AlarmStatus, VitalParameter, AlarmAckAction } from './enums';

/**
 * Base alarm type
 */
export interface Alarm {
  id: number;
  patientId: number;
  type: AlarmType;
  parameter: VitalParameter | string;
  value: number | null;
  threshold: number | null;
  message: string;
  status: AlarmStatus;
  triggeredAt: Date;
  resolvedAt: Date | null;
  silencedUntil: Date | null;
}

/**
 * Alarm with patient info (for alarm list views)
 */
export interface AlarmWithPatient extends Alarm {
  patient: {
    id: number;
    mrn: string;
    name: string;
    bedNumber: string | null;
  };
}

/**
 * Alarm acknowledgment record
 */
export interface AlarmAcknowledgment {
  id: number;
  alarmId: number;
  userId: number;
  action: AlarmAckAction;
  note: string | null;
  createdAt: Date;
}

/**
 * Alarm acknowledgment with user info
 */
export interface AlarmAcknowledgmentWithUser extends AlarmAcknowledgment {
  user: {
    id: number;
    fullName: string;
    initials: string | null;
  };
}

/**
 * Alarm with full relations
 */
export interface AlarmWithRelations extends AlarmWithPatient {
  acknowledgments: AlarmAcknowledgmentWithUser[];
}

/**
 * Alarm summary (for dashboard widgets)
 */
export interface AlarmSummary {
  id: number;
  type: AlarmType;
  parameter: string;
  message: string;
  triggeredAt: Date;
  status: AlarmStatus;
}

/**
 * Active alarm count by type
 */
export interface AlarmCounts {
  critical: number;
  warning: number;
  advisory: number;
  total: number;
}

/**
 * Acknowledge alarm request
 */
export interface AcknowledgeAlarmRequest {
  action: AlarmAckAction;
  note?: string;
  silenceDuration?: number; // Duration in minutes to silence
}

/**
 * Silence alarm request
 */
export interface SilenceAlarmRequest {
  duration: number; // Duration in minutes
  note?: string;
}

/**
 * Create alarm request (for manual alarm creation)
 */
export interface CreateAlarmRequest {
  patientId: number;
  type: AlarmType;
  parameter: string;
  value?: number;
  threshold?: number;
  message: string;
}

/**
 * Alarm query filters
 */
export interface AlarmQueryFilters {
  patientId?: number;
  type?: AlarmType | AlarmType[];
  status?: AlarmStatus | AlarmStatus[];
  parameter?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Alarm threshold configuration
 */
export interface AlarmThreshold {
  parameter: VitalParameter | string;
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  enabled: boolean;
}

/**
 * Alarm limit preset
 */
export interface AlarmLimitPreset {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  limits: string; // JSON string of AlarmThreshold[]
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parsed alarm limits
 */
export interface ParsedAlarmLimits {
  spo2?: { min: number; max: number };
  pr?: { min: number; max: number };
  rr?: { min: number; max: number };
  temp?: { min: number; max: number };
  fio2?: { min: number; max: number };
  pi?: { min: number; max: number };
  bp_systolic?: { min: number; max: number };
  bp_diastolic?: { min: number; max: number };
  bp_mean?: { min: number; max: number };
}

/**
 * Real-time alarm event (from MQTT or WebSocket)
 */
export interface RealtimeAlarmEvent {
  eventType: 'triggered' | 'acknowledged' | 'resolved' | 'silenced';
  alarm: Alarm;
  timestamp: string;
  userId?: number;
}

/**
 * Alarm statistics
 */
export interface AlarmStats {
  period: string; // e.g., "24h", "7d", "30d"
  totalAlarms: number;
  criticalAlarms: number;
  warningAlarms: number;
  advisoryAlarms: number;
  acknowledgedCount: number;
  averageResponseTime: number | null; // in seconds
  alarmsByParameter: Record<string, number>;
  topPatients: Array<{
    patientId: number;
    patientName: string;
    alarmCount: number;
  }>;
}

/**
 * Alarm escalation rule
 */
export interface AlarmEscalationRule {
  id: string;
  name: string;
  alarmType: AlarmType;
  unacknowledgedDuration: number; // in seconds
  escalationLevel: number;
  notifyRoles: string[];
  message: string;
  enabled: boolean;
}

/**
 * Alarm sound configuration
 */
export interface AlarmSoundConfig {
  enabled: boolean;
  criticalSound: string;
  warningSound: string;
  advisorySound: string;
  volume: number; // 0-1
  repeatInterval: number; // in seconds
}

/**
 * Default alarm thresholds by gestational age category
 */
export const DEFAULT_ALARM_THRESHOLDS: Record<string, ParsedAlarmLimits> = {
  extremely_preterm: {
    spo2: { min: 88, max: 95 },
    pr: { min: 100, max: 180 },
    rr: { min: 30, max: 70 },
    temp: { min: 36.5, max: 37.5 },
  },
  very_preterm: {
    spo2: { min: 88, max: 95 },
    pr: { min: 100, max: 180 },
    rr: { min: 30, max: 70 },
    temp: { min: 36.5, max: 37.5 },
  },
  moderate_preterm: {
    spo2: { min: 90, max: 98 },
    pr: { min: 100, max: 180 },
    rr: { min: 25, max: 60 },
    temp: { min: 36.5, max: 37.5 },
  },
  late_preterm: {
    spo2: { min: 92, max: 100 },
    pr: { min: 100, max: 180 },
    rr: { min: 25, max: 60 },
    temp: { min: 36.5, max: 37.5 },
  },
  term: {
    spo2: { min: 95, max: 100 },
    pr: { min: 100, max: 160 },
    rr: { min: 25, max: 60 },
    temp: { min: 36.5, max: 37.5 },
  },
};
