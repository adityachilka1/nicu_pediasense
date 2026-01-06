import { NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError } from './errors';

// Re-export rate limiting from dedicated module
// Uses Redis when available, falls back to in-memory
export {
  rateLimit,
  rateLimitAsync,
  getRateLimitInfo,
  resetRateLimit,
  getRateLimitHeaders,
  getRateLimitConfig,
  getRateLimiterStatus,
} from './rate-limiter';

// Type definitions
export type Role = 'admin' | 'physician' | 'charge_nurse' | 'staff_nurse' | 'administrative';

export interface Session {
  user: {
    id?: string;
    email?: string;
    role?: string;
    name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CorsHeaders {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Methods': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Credentials': string;
  'Access-Control-Max-Age': string;
  'Vary': string;
}

export interface SecurityHeaders {
  'X-Frame-Options': string;
  'X-Content-Type-Options': string;
  'X-XSS-Protection': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Content-Security-Policy': string;
  'Strict-Transport-Security'?: string;
}

// Security headers for responses
export const securityHeaders: SecurityHeaders = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS filter
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy (disable unnecessary features)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',

  // Content Security Policy (adjust as needed)
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),

  // HSTS (enable HTTPS)
  ...(process.env.NODE_ENV === 'production' && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  }),
};

// Apply security headers to response
export function applySecurityHeaders(response: Response): NextResponse {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(securityHeaders)) {
    if (value) {
      headers.set(key, value);
    }
  }

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Request type with headers
interface RequestWithHeaders {
  headers: {
    get: (name: string) => string | null;
  };
  method?: string;
}

// Get client IP for rate limiting
export function getClientIP(request: RequestWithHeaders): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

// CORS configuration - SECURITY: Never use '*' in production
const ALLOWED_ORIGINS: string[] = (() => {
  const envOrigin = process.env.ALLOWED_ORIGIN;

  // In production, require explicit origin configuration
  if (process.env.NODE_ENV === 'production') {
    if (!envOrigin || envOrigin === '*') {
      console.warn(
        'SECURITY WARNING: ALLOWED_ORIGIN must be set to a specific domain in production. ' +
        'Using default localhost:3000 as fallback.'
      );
      return ['http://localhost:3000'];
    }
    // Allow comma-separated list of origins
    return envOrigin.split(',').map(o => o.trim());
  }

  // In development, allow localhost variations
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    envOrigin,
  ].filter((origin): origin is string => Boolean(origin));
})();

/**
 * Get CORS headers for a specific origin
 * @param origin - The request origin
 * @returns CORS headers
 */
export function getCorsHeaders(origin: string | null): CorsHeaders {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] ?? 'http://localhost:3000';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Vary': 'Origin', // Important for caching with multiple origins
  };
}

// Legacy export for backwards compatibility (uses first allowed origin)
export const corsHeaders: CorsHeaders = getCorsHeaders(ALLOWED_ORIGINS[0] ?? null);

/**
 * Handle CORS preflight and validate origin
 * @param request - The incoming request
 * @returns Response for preflight or null to continue
 */
export function handleCORS(request: RequestWithHeaders): NextResponse | null {
  const origin = request.headers.get('origin');

  // Check if origin is allowed
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    // In production, reject requests from unknown origins
    if (process.env.NODE_ENV === 'production') {
      console.warn(`CORS: Rejected request from unauthorized origin: ${origin}`);
      return new NextResponse(null, {
        status: 403,
        statusText: 'Forbidden - Origin not allowed',
      });
    }
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    const corsHeadersValue = getCorsHeaders(origin ?? (ALLOWED_ORIGINS[0] ?? null));
    return new NextResponse(null, {
      status: 204,
      headers: corsHeadersValue as unknown as HeadersInit,
    });
  }

  return null;
}

/**
 * Check if a request origin is allowed
 * @param origin - The request origin
 * @returns boolean
 */
export function isOriginAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}

// Sanitize string input
export function sanitizeString(input: string): string;
export function sanitizeString<T>(input: T): T;
export function sanitizeString<T>(input: T | string): T | string {
  if (typeof input !== 'string') return input;

  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

// Type for sanitizable input
type SanitizableValue = string | number | boolean | null | undefined | SanitizableObject | SanitizableValue[];
interface SanitizableObject {
  [key: string]: SanitizableValue;
}

// Sanitize object recursively
export function sanitizeInput<T extends SanitizableValue>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput) as T;
  }

  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, SanitizableValue> = {};
    for (const [key, value] of Object.entries(obj as SanitizableObject)) {
      sanitized[sanitizeString(key)] = sanitizeInput(value);
    }
    return sanitized as T;
  }

  return obj;
}

// Check if request is from authenticated session
export function requireAuth(session: Session | null | undefined): Session {
  if (!session || !session.user) {
    throw new AuthenticationError('Authentication required');
  }
  return session;
}

// Standardized role names - use these constants in API routes
export const ROLES = {
  ADMIN: 'admin',
  PHYSICIAN: 'physician',
  CHARGE_NURSE: 'charge_nurse',
  STAFF_NURSE: 'staff_nurse',
  ADMINISTRATIVE: 'administrative',
} as const;

export type RoleKey = keyof typeof ROLES;
export type RoleValue = typeof ROLES[RoleKey];

// Role groups for common permission patterns
export const ROLE_GROUPS = {
  ALL_CLINICAL: [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE, ROLES.STAFF_NURSE] as RoleValue[],
  LEADERSHIP: [ROLES.ADMIN, ROLES.PHYSICIAN, ROLES.CHARGE_NURSE] as RoleValue[],
  ADMIN_ONLY: [ROLES.ADMIN] as RoleValue[],
} as const;

export type RoleGroupKey = keyof typeof ROLE_GROUPS;

// Normalize role string for comparison
function normalizeRole(role: string | undefined | null): string {
  if (!role) return '';
  return role.toLowerCase().replace(/\s+/g, '_');
}

// Check role authorization
export function requireRole(session: Session | null | undefined, allowedRoles: readonly string[]): Session {
  const validatedSession = requireAuth(session);

  const userRole = normalizeRole(validatedSession.user.role);
  const normalizedAllowed = allowedRoles.map(normalizeRole);

  if (!normalizedAllowed.includes(userRole)) {
    throw new AuthorizationError(`Role '${validatedSession.user.role}' is not authorized for this action`);
  }

  return validatedSession;
}
