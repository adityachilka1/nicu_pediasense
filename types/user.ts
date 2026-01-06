/**
 * NICU Dashboard - User and Session Type Definitions
 */

import type { UserRole } from './enums';

/**
 * Base user type representing a staff member
 */
export interface User {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  initials: string | null;
  active: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User type without sensitive fields (for client-side use)
 */
export interface SafeUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  initials: string | null;
  active: boolean;
  lastLogin: string | null;
}

/**
 * User creation request
 */
export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  initials?: string;
}

/**
 * User update request
 */
export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  role?: UserRole;
  initials?: string;
  active?: boolean;
}

/**
 * Password change request
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Authentication session
 */
export interface Session {
  user: SafeUser;
  expires: string;
  accessToken?: string;
}

/**
 * Session with additional metadata
 */
export interface ExtendedSession extends Session {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Token payload structure (decoded JWT)
 */
export interface TokenPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Permission definition
 */
export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, unknown>;
}

/**
 * Role-based permission mapping
 */
export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

/**
 * User with relations
 */
export interface UserWithRelations extends User {
  notes?: number; // Count of notes authored
  alarmAcks?: number; // Count of alarm acknowledgments
  ordersCreated?: number; // Count of orders created
}

/**
 * Audit log entry for user actions
 */
export interface UserAuditEntry {
  id: number;
  userId: number | null;
  action: string;
  resource: string | null;
  resourceId: number | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

/**
 * User notification
 */
export interface UserNotification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: string;
  resourceType: string | null;
  resourceId: number | null;
  status: string;
  readAt: Date | null;
  dismissedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}
