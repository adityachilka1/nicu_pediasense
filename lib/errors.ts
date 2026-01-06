import { NextResponse } from 'next/server';
import logger from './logger';

// Error code types
export type ErrorCode =
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED';

// Validation error detail type
export interface ValidationErrorDetail {
  field: string;
  message: string;
}

// Error response type
export interface ErrorResponseBody {
  error: {
    message: string;
    code: ErrorCode | string;
    details?: ValidationErrorDetail[];
    retryAfter?: number;
    stack?: string;
  };
  meta: {
    timestamp: string;
  };
}

// Request context type for error handler
export interface RequestContext {
  params?: Record<string, string | string[]>;
  [key: string]: unknown;
}

// Application error types
export class AppError extends Error {
  public statusCode: number;
  public code: ErrorCode | string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode | string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {
  public readonly errors: ValidationErrorDetail[];

  constructor(errors: ValidationErrorDetail[]) {
    super('Validation failed', 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// Type guard to check if error has specific properties
interface ErrorWithExtras extends Error {
  statusCode?: number;
  code?: string;
  errors?: ValidationErrorDetail[];
  retryAfter?: number;
}

// Error response formatter
export function formatErrorResponse(error: ErrorWithExtras): ErrorResponseBody {
  const isProduction = process.env.NODE_ENV === 'production';

  // Base response
  const response: ErrorResponseBody = {
    error: {
      message: error.message || 'An unexpected error occurred',
      code: error.code || 'INTERNAL_ERROR',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  // Add validation errors if present
  if (error.errors) {
    response.error.details = error.errors;
  }

  // Add retry-after for rate limiting
  if (error.retryAfter) {
    response.error.retryAfter = error.retryAfter;
  }

  // Include stack trace in development only
  if (!isProduction && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

// Handler function type
export type ApiHandler = (
  request: Request,
  context: RequestContext
) => Promise<NextResponse>;

// API error handler wrapper
export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (request: Request, context: RequestContext): Promise<NextResponse> => {
    const startTime = Date.now();

    try {
      const response = await handler(request, context);

      // Log successful requests
      logger.response(request, response.status, Date.now() - startTime);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Cast error to our extended type
      const err = error as ErrorWithExtras;

      // Determine status code
      const statusCode = err.statusCode || 500;

      // Log the error
      if (statusCode >= 500) {
        logger.exception(err, {
          url: request.url,
          method: request.method,
          duration: `${duration}ms`,
        });
      } else {
        logger.warn(err.message, {
          url: request.url,
          method: request.method,
          statusCode,
          code: err.code,
        });
      }

      // Format and return error response
      const errorResponse = formatErrorResponse(err);

      const response = NextResponse.json(errorResponse, { status: statusCode });

      // Add rate limit headers if applicable
      if (err.retryAfter) {
        response.headers.set('Retry-After', err.retryAfter.toString());
      }

      return response;
    }
  };
}

// Simple error boundary for client components
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    return process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message;
  }

  return 'An unexpected error occurred';
}
