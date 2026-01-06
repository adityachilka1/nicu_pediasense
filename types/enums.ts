/**
 * NICU Dashboard - Enum Type Definitions
 *
 * These enums map to Prisma schema enums and provide type-safe
 * constants for use throughout the application.
 */

// Re-export Prisma enums directly for database operations
export {
  FeedingType,
  FeedingRoute,
  FeedingTolerance,
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
} from '@prisma/client';

/**
 * User roles in the NICU system
 */
export const UserRole = {
  ADMIN: 'admin',
  PHYSICIAN: 'physician',
  CHARGE_NURSE: 'charge_nurse',
  STAFF_NURSE: 'staff_nurse',
  ADMINISTRATIVE: 'administrative',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

/**
 * Patient status values
 */
export const PatientStatus = {
  NORMAL: 'normal',
  WARNING: 'warning',
  CRITICAL: 'critical',
  DISCHARGED: 'discharged',
} as const;

export type PatientStatus = typeof PatientStatus[keyof typeof PatientStatus];

/**
 * Patient gender values
 */
export const Gender = {
  MALE: 'M',
  FEMALE: 'F',
  UNKNOWN: 'U',
} as const;

export type Gender = typeof Gender[keyof typeof Gender];

/**
 * Bed status values
 */
export const BedStatus = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  CLEANING: 'cleaning',
  MAINTENANCE: 'maintenance',
} as const;

export type BedStatus = typeof BedStatus[keyof typeof BedStatus];

/**
 * Alarm type/severity levels
 */
export const AlarmType = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  ADVISORY: 'advisory',
} as const;

export type AlarmType = typeof AlarmType[keyof typeof AlarmType];

/**
 * Alarm status values
 */
export const AlarmStatus = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  SILENCED: 'silenced',
  RESOLVED: 'resolved',
} as const;

export type AlarmStatus = typeof AlarmStatus[keyof typeof AlarmStatus];

/**
 * Vital sign parameters
 */
export const VitalParameter = {
  SPO2: 'spo2',
  PULSE_RATE: 'pr',
  RESPIRATORY_RATE: 'rr',
  TEMPERATURE: 'temp',
  FIO2: 'fio2',
  PERFUSION_INDEX: 'pi',
  BP_SYSTOLIC: 'bp_systolic',
  BP_DIASTOLIC: 'bp_diastolic',
  BP_MEAN: 'bp_mean',
  APNEA: 'apnea',
  BRADYCARDIA: 'brady',
} as const;

export type VitalParameter = typeof VitalParameter[keyof typeof VitalParameter];

/**
 * Vital sign data source
 */
export const VitalSource = {
  MONITOR: 'monitor',
  MANUAL: 'manual',
  DEVICE: 'device',
} as const;

export type VitalSource = typeof VitalSource[keyof typeof VitalSource];

/**
 * Device types
 */
export const DeviceType = {
  MONITOR: 'monitor',
  VENTILATOR: 'ventilator',
  INFUSION_PUMP: 'infusion_pump',
  PHOTOTHERAPY: 'phototherapy',
  CPAP: 'cpap',
  INCUBATOR: 'incubator',
  PULSE_OXIMETER: 'pulse_oximeter',
  ECG: 'ecg',
} as const;

export type DeviceType = typeof DeviceType[keyof typeof DeviceType];

/**
 * Device status values
 */
export const DeviceStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
  OFFLINE: 'offline',
  ERROR: 'error',
} as const;

export type DeviceStatus = typeof DeviceStatus[keyof typeof DeviceStatus];

/**
 * Note types
 */
export const NoteType = {
  PROGRESS: 'progress',
  NURSING: 'nursing',
  PHYSICIAN: 'physician',
  HANDOFF: 'handoff',
} as const;

export type NoteType = typeof NoteType[keyof typeof NoteType];

/**
 * Notification types
 */
export const NotificationType = {
  INFO: 'info',
  WARNING: 'warning',
  ALERT: 'alert',
  SUCCESS: 'success',
  TASK: 'task',
} as const;

export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

/**
 * Notification categories
 */
export const NotificationCategory = {
  SYSTEM: 'system',
  PATIENT: 'patient',
  ALARM: 'alarm',
  MESSAGE: 'message',
  TASK: 'task',
  ANNOUNCEMENT: 'announcement',
} as const;

export type NotificationCategory = typeof NotificationCategory[keyof typeof NotificationCategory];

/**
 * Notification priority levels
 */
export const NotificationPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type NotificationPriority = typeof NotificationPriority[keyof typeof NotificationPriority];

/**
 * Growth measurement types
 */
export const GrowthMeasurementType = {
  ROUTINE: 'routine',
  ADMISSION: 'admission',
  DISCHARGE: 'discharge',
  WEEKLY: 'weekly',
} as const;

export type GrowthMeasurementType = typeof GrowthMeasurementType[keyof typeof GrowthMeasurementType];

/**
 * Alarm acknowledgment actions
 */
export const AlarmAckAction = {
  ACKNOWLEDGED: 'acknowledged',
  SILENCED: 'silenced',
  ESCALATED: 'escalated',
} as const;

export type AlarmAckAction = typeof AlarmAckAction[keyof typeof AlarmAckAction];

/**
 * Family contact relationships
 */
export const FamilyRelationship = {
  MOTHER: 'mother',
  FATHER: 'father',
  GUARDIAN: 'guardian',
  GRANDPARENT: 'grandparent',
  SIBLING: 'sibling',
  OTHER: 'other',
} as const;

export type FamilyRelationship = typeof FamilyRelationship[keyof typeof FamilyRelationship];

/**
 * Message delivery channels
 */
export const MessageChannel = {
  APP: 'app',
  EMAIL: 'email',
  SMS: 'sms',
} as const;

export type MessageChannel = typeof MessageChannel[keyof typeof MessageChannel];

/**
 * Message delivery status
 */
export const MessageStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const;

export type MessageStatus = typeof MessageStatus[keyof typeof MessageStatus];
