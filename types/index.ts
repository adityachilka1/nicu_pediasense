/**
 * NICU Dashboard - Shared Type Definitions
 *
 * This file exports all shared types for the application.
 * Import types from here for consistent typing across the codebase.
 */

// Re-export all types from individual modules
export * from './enums';
export * from './user';
export * from './patient';
export * from './vital';
export * from './alarm';
export * from './api';
export * from './clinical';

// Re-export Prisma-generated types for convenience
export type {
  User as PrismaUser,
  Patient as PrismaPatient,
  Vital as PrismaVital,
  Alarm as PrismaAlarm,
  Bed as PrismaBed,
  Device as PrismaDevice,
  Note as PrismaNote,
  AuditLog as PrismaAuditLog,
  Order as PrismaOrder,
  CarePlan as PrismaCarePlan,
  DischargePlan as PrismaDischargePlan,
  HandoffNote as PrismaHandoffNote,
  FeedingLog as PrismaFeedingLog,
  FlowsheetEntry as PrismaFlowsheetEntry,
  GrowthMeasurement as PrismaGrowthMeasurement,
  FamilyContact as PrismaFamilyContact,
  FamilyMessage as PrismaFamilyMessage,
  Milestone as PrismaMilestone,
  Notification as PrismaNotification,
} from '@prisma/client';
