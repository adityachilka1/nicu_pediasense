import { NextResponse } from 'next/server';
import logger from './logger';

// Application error types
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

export class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.errors = errors;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.code = 'AUTHENTICATION_ERROR';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Permission denied') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    this.code = 'AUTHORIZATION_ERROR';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.code = 'CONFLICT';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('Too many requests');
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.code = 'RATE_LIMIT_EXCEEDED';
    this.retryAfter = retryAfter;
  }
}

// Error response formatter
export function formatErrorResponse(error) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Base response
  const response = {
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

// API error handler wrapper
export function withErrorHandler(handler) {
  return async (request, context) => {
    const startTime = Date.now();

    try {
      const response = await handler(request, context);

      // Log successful requests
      logger.response(request, response.status, Date.now() - startTime);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Determine status code
      const statusCode = error.statusCode || 500;

      // Log the error
      if (statusCode >= 500) {
        logger.exception(error, {
          url: request.url,
          method: request.method,
          duration: `${duration}ms`,
        });
      } else {
        logger.warn(error.message, {
          url: request.url,
          method: request.method,
          statusCode,
          code: error.code,
        });
      }

      // Format and return error response
      const errorResponse = formatErrorResponse(error);

      const response = NextResponse.json(errorResponse, { status: statusCode });

      // Add rate limit headers if applicable
      if (error.retryAfter) {
        response.headers.set('Retry-After', error.retryAfter.toString());
      }

      return response;
    }
  };
}

// Simple error boundary for client components
export function getErrorMessage(error) {
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
