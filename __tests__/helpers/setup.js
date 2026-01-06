/**
 * Test Helper Utilities
 * Common fixtures, mocks, and utilities for API route testing
 */

// ============================================================
// Mock Session Creators
// ============================================================

/**
 * Create a mock authenticated session
 * @param {string} role - User role (admin, physician, charge_nurse, staff_nurse, administrative)
 * @param {number} userId - User ID
 * @returns {Object} Mock session object
 */
export function createMockSession(role = 'staff_nurse', userId = 1) {
  return {
    user: {
      id: userId.toString(),
      email: `${role.replace('_', '.')}@hospital.org`,
      role: role,
      fullName: 'Test User',
    },
  };
}

/**
 * Create a mock unauthenticated session (returns null)
 */
export function createUnauthenticatedSession() {
  return null;
}

// ============================================================
// Mock Request Creators
// ============================================================

/**
 * Create a mock Next.js Request object
 * @param {Object} options - Request options
 * @param {string} options.url - Request URL
 * @param {string} options.method - HTTP method (GET, POST, PATCH, DELETE)
 * @param {Object} options.body - Request body
 * @param {Object} options.headers - Additional headers
 * @returns {Object} Mock request object
 */
export function createMockRequest(options = {}) {
  const url = new URL(options.url || 'http://localhost:3000/api/test');

  return {
    url: url.toString(),
    method: options.method || 'GET',
    headers: {
      get: jest.fn((header) => {
        const headers = {
          'x-forwarded-for': '127.0.0.1',
          'content-type': 'application/json',
          ...options.headers,
        };
        return headers[header.toLowerCase()] || null;
      }),
    },
    json: jest.fn().mockResolvedValue(options.body || {}),
  };
}

/**
 * Create a mock request with params (for dynamic routes like /api/patients/[id])
 * @param {Object} params - Route parameters
 * @param {Object} options - Request options (same as createMockRequest)
 * @returns {Object} Object with request and context
 */
export function createMockRequestWithParams(params = {}, options = {}) {
  const request = createMockRequest(options);
  const context = { params: Promise.resolve(params) };
  return { request, context };
}

// ============================================================
// Mock Prisma Client Setup
// ============================================================

/**
 * Get a mock Prisma client with common models
 * Note: This should be used in jest.mock() calls in test files
 */
export function getMockPrisma() {
  return {
    patient: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    vital: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    alarm: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    alarmAcknowledgment: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    bed: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    note: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      // Execute the transaction callback with the same mock client
      if (typeof callback === 'function') {
        return callback(getMockPrisma());
      }
      return Promise.resolve(callback);
    }),
  };
}

// ============================================================
// Test Data Fixtures
// ============================================================

/**
 * Create a mock patient object
 */
export function createMockPatient(overrides = {}) {
  return {
    id: 1,
    mrn: 'MRN-001',
    name: 'Baby Doe',
    gender: 'M',
    gestationalAge: '32+4',
    birthWeight: 1.5,
    currentWeight: 1.6,
    status: 'normal',
    dayOfLife: 5,
    admitDate: new Date('2025-01-15'),
    dateOfBirth: new Date('2025-01-10'),
    bedId: 1,
    dischargeDate: null,
    alarmLimits: JSON.stringify({
      spo2: [88, 95],
      pr: [100, 180],
      rr: [30, 70],
      temp: [36.0, 37.5],
    }),
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    bed: {
      id: 1,
      bedNumber: '01',
      status: 'occupied',
    },
    vitals: [],
    alarms: [],
    notes: [],
    _count: {
      alarms: 0,
    },
    ...overrides,
  };
}

/**
 * Create a mock vital signs object
 */
export function createMockVital(overrides = {}) {
  return {
    id: 1,
    patientId: 1,
    heartRate: 140,
    spo2: 98,
    respRate: 45,
    temperature: 36.8,
    fio2: 21,
    pi: 2.5,
    recordedAt: new Date(),
    source: 'monitor',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock alarm object
 */
export function createMockAlarm(overrides = {}) {
  return {
    id: 1,
    patientId: 1,
    type: 'warning',
    parameter: 'spo2',
    value: 85,
    threshold: 88,
    message: 'SpO2 below threshold',
    status: 'active',
    triggeredAt: new Date(),
    resolvedAt: null,
    silencedUntil: null,
    createdAt: new Date(),
    patient: {
      name: 'Baby Doe',
      bed: {
        bedNumber: '01',
      },
    },
    acknowledgments: [],
    ...overrides,
  };
}

/**
 * Create a mock bed object
 */
export function createMockBed(overrides = {}) {
  return {
    id: 1,
    bedNumber: '01',
    status: 'available',
    location: 'NICU-A',
    patient: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock audit log entry
 */
export function createMockAuditLog(overrides = {}) {
  return {
    id: 1,
    userId: 1,
    action: 'view_patient',
    resource: 'patient',
    resourceId: 1,
    details: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ============================================================
// Common Mock Setup
// ============================================================

/**
 * Setup common mocks for API route tests
 * Call this in beforeEach() in test files
 */
export function setupCommonMocks() {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset modules
  jest.resetModules();
}

/**
 * Create standard mock implementations for dependencies
 * Returns an object with mock functions ready to use
 */
export function createStandardMocks() {
  return {
    auth: jest.fn(),
    rateLimit: jest.fn(() => ({
      remaining: 99,
      limit: 100,
      resetTime: Date.now() + 60000,
      store: 'memory',
    })),
    rateLimitAsync: jest.fn(() =>
      Promise.resolve({
        remaining: 99,
        limit: 100,
        resetTime: Date.now() + 60000,
        store: 'memory',
      })
    ),
    getClientIP: jest.fn(() => '127.0.0.1'),
    sanitizeInput: jest.fn((input) => input),
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      audit: jest.fn(),
      response: jest.fn(),
      exception: jest.fn(),
    },
    createTimer: jest.fn(() => ({
      elapsed: jest.fn(() => 100),
    })),
  };
}

// ============================================================
// Assertion Helpers
// ============================================================

/**
 * Assert that response is a standard error response
 */
export function expectErrorResponse(data, statusCode, errorCode) {
  expect(data).toHaveProperty('error');
  expect(data.error).toHaveProperty('message');
  expect(data.error).toHaveProperty('code', errorCode);
  expect(data).toHaveProperty('meta');
  expect(data.meta).toHaveProperty('timestamp');
}

/**
 * Assert that response is a paginated success response
 */
export function expectPaginatedResponse(data) {
  expect(data).toHaveProperty('data');
  expect(data).toHaveProperty('meta');
  expect(data.meta).toHaveProperty('total');
  expect(data.meta).toHaveProperty('limit');
  expect(data.meta).toHaveProperty('offset');
  expect(Array.isArray(data.data)).toBe(true);
}

/**
 * Assert that response is a standard success response
 */
export function expectSuccessResponse(data) {
  expect(data).toHaveProperty('data');
}

/**
 * Assert that validation error contains specific field error
 */
export function expectValidationError(data, field, messageContains = null) {
  expect(data.error.code).toBe('VALIDATION_ERROR');
  expect(data.error.details).toBeDefined();
  const fieldError = data.error.details.find((err) => err.field === field);
  expect(fieldError).toBeDefined();
  if (messageContains) {
    expect(fieldError.message).toContain(messageContains);
  }
}

// ============================================================
// Valid Test Data
// ============================================================

/**
 * Valid patient creation data
 */
export const validPatientData = {
  mrn: 'MRN-002',
  name: 'Baby Smith',
  dateOfBirth: '2025-01-20T00:00:00.000Z',
  gender: 'F',
  gestationalAge: '34+0',
  birthWeight: 2.0,
  currentWeight: 2.1,
  bedNumber: '02',
  alarmLimits: {
    spo2: [88, 95],
    pr: [100, 180],
  },
};

/**
 * Valid patient update data
 */
export const validPatientUpdateData = {
  name: 'Baby Smith Updated',
  currentWeight: 2.2,
  dayOfLife: 7,
  status: 'normal',
  alarmLimits: {
    spo2: [88, 95],
    pr: [100, 180],
    rr: [30, 70],
  },
};

/**
 * Valid vital signs data
 */
export const validVitalData = {
  heartRate: 145,
  spo2: 97,
  respRate: 48,
  temperature: 37.0,
  fio2: 25,
  pi: 3.2,
  source: 'monitor',
};

/**
 * Valid alarm action data
 */
export const validAlarmActionData = {
  action: 'acknowledge',
  alarmIds: [1, 2, 3],
  silenceDuration: 120,
};
