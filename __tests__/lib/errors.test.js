/**
 * Error Handling Tests
 * Tests for custom error classes and error handling utilities
 */

// Mock next/server before importing
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, options) => ({ body, status: options?.status || 200 })),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    exception: jest.fn(),
  },
}));

import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  formatErrorResponse,
  getErrorMessage,
} from '@/lib/errors';

// ============================================================
// AppError (Base Class) Tests
// ============================================================

describe('AppError', () => {
  test('creates error with default values', () => {
    const error = new AppError('Something went wrong');

    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('AppError');
  });

  test('accepts custom status code and error code', () => {
    const error = new AppError('Custom error', 418, 'TEAPOT_ERROR');

    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('TEAPOT_ERROR');
  });

  test('extends Error class', () => {
    const error = new AppError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error.stack).toBeDefined();
  });
});

// ============================================================
// ValidationError Tests
// ============================================================

describe('ValidationError', () => {
  test('creates validation error with field errors', () => {
    const errors = [
      { field: 'email', message: 'Invalid email format' },
      { field: 'password', message: 'Password too short' },
    ];

    const error = new ValidationError(errors);

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed');
    expect(error.errors).toEqual(errors);
    expect(error.name).toBe('ValidationError');
  });

  test('extends AppError', () => {
    const error = new ValidationError([]);
    expect(error).toBeInstanceOf(AppError);
    expect(error.isOperational).toBe(true);
  });

  test('can have empty errors array', () => {
    const error = new ValidationError([]);
    expect(error.errors).toEqual([]);
  });

  test('handles single field error', () => {
    const error = new ValidationError([{ field: 'mrn', message: 'MRN is required' }]);
    expect(error.errors).toHaveLength(1);
    expect(error.errors[0].field).toBe('mrn');
  });
});

// ============================================================
// AuthenticationError Tests
// ============================================================

describe('AuthenticationError', () => {
  test('creates with default message', () => {
    const error = new AuthenticationError();

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.message).toBe('Authentication required');
    expect(error.name).toBe('AuthenticationError');
  });

  test('accepts custom message', () => {
    const error = new AuthenticationError('Invalid credentials');
    expect(error.message).toBe('Invalid credentials');
  });

  test('extends AppError', () => {
    const error = new AuthenticationError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ============================================================
// AuthorizationError Tests
// ============================================================

describe('AuthorizationError', () => {
  test('creates with default message', () => {
    const error = new AuthorizationError();

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('AUTHORIZATION_ERROR');
    expect(error.message).toBe('Permission denied');
    expect(error.name).toBe('AuthorizationError');
  });

  test('accepts custom message', () => {
    const error = new AuthorizationError('Admin access required');
    expect(error.message).toBe('Admin access required');
  });

  test('extends AppError', () => {
    const error = new AuthorizationError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ============================================================
// NotFoundError Tests
// ============================================================

describe('NotFoundError', () => {
  test('creates with default resource', () => {
    const error = new NotFoundError();

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Resource not found');
    expect(error.name).toBe('NotFoundError');
  });

  test('includes resource name in message', () => {
    const error = new NotFoundError('Patient');
    expect(error.message).toBe('Patient not found');
  });

  test('handles various resource types', () => {
    expect(new NotFoundError('Bed').message).toBe('Bed not found');
    expect(new NotFoundError('User').message).toBe('User not found');
    expect(new NotFoundError('Alarm').message).toBe('Alarm not found');
  });

  test('extends AppError', () => {
    const error = new NotFoundError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ============================================================
// ConflictError Tests
// ============================================================

describe('ConflictError', () => {
  test('creates with default message', () => {
    const error = new ConflictError();

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Resource conflict');
    expect(error.name).toBe('ConflictError');
  });

  test('accepts custom message', () => {
    const error = new ConflictError('Bed is already occupied');
    expect(error.message).toBe('Bed is already occupied');
  });

  test('extends AppError', () => {
    const error = new ConflictError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ============================================================
// RateLimitError Tests
// ============================================================

describe('RateLimitError', () => {
  test('creates with default retry-after', () => {
    const error = new RateLimitError();

    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.message).toBe('Too many requests');
    expect(error.retryAfter).toBe(60);
    expect(error.name).toBe('RateLimitError');
  });

  test('accepts custom retry-after value', () => {
    const error = new RateLimitError(120);
    expect(error.retryAfter).toBe(120);
  });

  test('extends AppError', () => {
    const error = new RateLimitError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ============================================================
// formatErrorResponse Tests
// ============================================================

describe('formatErrorResponse', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('formats basic error', () => {
    const error = new AppError('Something went wrong', 500, 'SERVER_ERROR');
    const response = formatErrorResponse(error);

    expect(response.error.message).toBe('Something went wrong');
    expect(response.error.code).toBe('SERVER_ERROR');
    expect(response.meta.timestamp).toBeDefined();
  });

  test('includes validation errors', () => {
    const errors = [
      { field: 'email', message: 'Required' },
      { field: 'name', message: 'Too short' },
    ];
    const error = new ValidationError(errors);
    const response = formatErrorResponse(error);

    expect(response.error.details).toEqual(errors);
  });

  test('includes retry-after for rate limit errors', () => {
    const error = new RateLimitError(30);
    const response = formatErrorResponse(error);

    expect(response.error.retryAfter).toBe(30);
  });

  test('includes stack trace in development', () => {
    process.env.NODE_ENV = 'development';
    const error = new AppError('Dev error');
    const response = formatErrorResponse(error);

    expect(response.error.stack).toBeDefined();
  });

  test('excludes stack trace in production', () => {
    process.env.NODE_ENV = 'production';
    const error = new AppError('Prod error');
    const response = formatErrorResponse(error);

    expect(response.error.stack).toBeUndefined();
  });

  test('handles generic Error', () => {
    const error = new Error('Generic error');
    const response = formatErrorResponse(error);

    expect(response.error.message).toBe('Generic error');
    expect(response.error.code).toBe('INTERNAL_ERROR');
  });

  test('handles error without message', () => {
    const error = {};
    const response = formatErrorResponse(error);

    expect(response.error.message).toBe('An unexpected error occurred');
  });
});

// ============================================================
// getErrorMessage Tests
// ============================================================

describe('getErrorMessage', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('returns AppError message', () => {
    const error = new AppError('Custom app error');
    expect(getErrorMessage(error)).toBe('Custom app error');
  });

  test('returns ValidationError message', () => {
    const error = new ValidationError([]);
    expect(getErrorMessage(error)).toBe('Validation failed');
  });

  test('returns NotFoundError message', () => {
    const error = new NotFoundError('Patient');
    expect(getErrorMessage(error)).toBe('Patient not found');
  });

  test('returns Error message in development', () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('Development error');
    expect(getErrorMessage(error)).toBe('Development error');
  });

  test('hides Error message in production', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Secret internal error');
    expect(getErrorMessage(error)).toBe('An unexpected error occurred');
  });

  test('returns generic message for non-errors', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
    expect(getErrorMessage('string error')).toBe('An unexpected error occurred');
  });
});

// ============================================================
// Error Type Checking Tests
// ============================================================

describe('Error Type Hierarchy', () => {
  test('all custom errors extend AppError', () => {
    expect(new ValidationError([])).toBeInstanceOf(AppError);
    expect(new AuthenticationError()).toBeInstanceOf(AppError);
    expect(new AuthorizationError()).toBeInstanceOf(AppError);
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new ConflictError()).toBeInstanceOf(AppError);
    expect(new RateLimitError()).toBeInstanceOf(AppError);
  });

  test('all custom errors extend Error', () => {
    expect(new ValidationError([])).toBeInstanceOf(Error);
    expect(new AuthenticationError()).toBeInstanceOf(Error);
    expect(new AuthorizationError()).toBeInstanceOf(Error);
    expect(new NotFoundError()).toBeInstanceOf(Error);
    expect(new ConflictError()).toBeInstanceOf(Error);
    expect(new RateLimitError()).toBeInstanceOf(Error);
  });

  test('all operational errors have isOperational flag', () => {
    expect(new AppError('test').isOperational).toBe(true);
    expect(new ValidationError([]).isOperational).toBe(true);
    expect(new AuthenticationError().isOperational).toBe(true);
    expect(new NotFoundError().isOperational).toBe(true);
    expect(new RateLimitError().isOperational).toBe(true);
  });
});

// ============================================================
// HTTP Status Code Tests (HIPAA/Medical Compliance)
// ============================================================

describe('HTTP Status Codes (Medical System Standards)', () => {
  test('authentication errors return 401', () => {
    expect(new AuthenticationError().statusCode).toBe(401);
  });

  test('authorization errors return 403', () => {
    expect(new AuthorizationError().statusCode).toBe(403);
  });

  test('validation errors return 400 (not 422)', () => {
    // 400 is more widely supported than 422
    expect(new ValidationError([]).statusCode).toBe(400);
  });

  test('not found errors return 404', () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  test('conflict errors return 409', () => {
    expect(new ConflictError().statusCode).toBe(409);
  });

  test('rate limit errors return 429', () => {
    expect(new RateLimitError().statusCode).toBe(429);
  });

  test('internal errors return 500', () => {
    expect(new AppError('Internal').statusCode).toBe(500);
  });
});
