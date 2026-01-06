/**
 * NICU Dashboard - API Type Definitions
 *
 * Standard response types for consistent API contracts.
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: string;
}

/**
 * Error response structure
 */
export interface ApiError {
  success: false;
  error: string;
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  error?: string;
  timestamp?: string;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * List response (non-paginated)
 */
export interface ListResponse<T> {
  success: boolean;
  data: T[];
  count: number;
  error?: string;
  timestamp?: string;
}

/**
 * Single item response
 */
export interface SingleResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp?: string;
}

/**
 * Create operation response
 */
export interface CreateResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

/**
 * Update operation response
 */
export interface UpdateResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

/**
 * Delete operation response
 */
export interface DeleteResponse {
  success: boolean;
  message?: string;
  deletedId?: number;
  error?: string;
  timestamp?: string;
}

/**
 * Batch operation response
 */
export interface BatchResponse<T = unknown> {
  success: boolean;
  data?: T[];
  succeeded: number;
  failed: number;
  errors?: Array<{
    index: number;
    error: string;
  }>;
  timestamp?: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services: Record<string, {
    status: 'up' | 'down';
    latency?: number;
    message?: string;
  }>;
}

/**
 * Validation error detail
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse {
  success: false;
  error: 'Validation failed';
  code: 'VALIDATION_ERROR';
  details: ValidationError[];
  timestamp: string;
}

/**
 * Authentication error response
 */
export interface AuthErrorResponse {
  success: false;
  error: string;
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN';
  timestamp: string;
}

/**
 * Rate limit error response
 */
export interface RateLimitResponse {
  success: false;
  error: 'Rate limit exceeded';
  code: 'RATE_LIMITED';
  retryAfter: number; // seconds
  timestamp: string;
}

/**
 * API request options
 */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Search/filter request
 */
export interface SearchRequest<T = Record<string, unknown>> {
  query?: string;
  filters?: T;
  pagination?: PaginationParams;
}

/**
 * Search response with highlights
 */
export interface SearchResponse<T> extends PaginatedResponse<T> {
  highlights?: Record<string, string[]>;
  facets?: Record<string, Array<{ value: string; count: number }>>;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'vital_update'
  | 'alarm_triggered'
  | 'alarm_acknowledged'
  | 'alarm_resolved'
  | 'patient_update'
  | 'notification'
  | 'heartbeat'
  | 'error';

/**
 * WebSocket message wrapper
 */
export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  payload: T;
  timestamp: string;
  id?: string;
}

/**
 * MQTT topic types
 */
export type MqttTopic =
  | `nicu/vitals/${number}`
  | `nicu/alarms/${number}`
  | 'nicu/vitals/+'
  | 'nicu/alarms/+'
  | 'nicu/system/status';

/**
 * MQTT message wrapper
 */
export interface MqttMessage<T = unknown> {
  topic: string;
  payload: T;
  qos: 0 | 1 | 2;
  retain: boolean;
  timestamp: string;
}

/**
 * Type guard for API error response
 */
export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as ApiError).success === false &&
    'error' in response
  );
}

/**
 * Type guard for validation error response
 */
export function isValidationError(response: unknown): response is ValidationErrorResponse {
  if (!isApiError(response)) return false;
  if (!('code' in response) || !('details' in response)) return false;
  const resp = response as { code: unknown; details: unknown };
  return resp.code === 'VALIDATION_ERROR' && Array.isArray(resp.details);
}

/**
 * Type guard for auth error response
 */
export function isAuthError(response: unknown): response is AuthErrorResponse {
  return (
    isApiError(response) &&
    'code' in response &&
    ['UNAUTHORIZED', 'FORBIDDEN', 'TOKEN_EXPIRED', 'INVALID_TOKEN'].includes(
      (response as AuthErrorResponse).code
    )
  );
}

/**
 * Helper to create a success response
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to create an error response
 */
export function createErrorResponse(error: string, code?: string): ApiError {
  return {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
  };
}
