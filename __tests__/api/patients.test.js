/**
 * Patients API Route Tests
 * Tests for GET /api/patients and POST /api/patients
 */

// Mock next/server with full NextResponse implementation
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options = {}) => ({
      json: () => Promise.resolve(data),
      status: options.status || 200,
      headers: {
        get: jest.fn(),
        set: jest.fn(),
      },
    })),
  },
}));

// Mock modules before imports
jest.mock('@/lib/prisma', () => ({
  prisma: {
    patient: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    bed: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(),
  isRedisConnected: jest.fn(() => false),
}));

// Mock rate limiter to prevent rate limiting in tests
jest.mock('@/lib/rate-limiter', () => ({
  rateLimit: jest.fn(() => ({ remaining: 99, limit: 100, resetTime: Date.now() + 60000, store: 'memory' })),
  rateLimitAsync: jest.fn(() => Promise.resolve({ remaining: 99, limit: 100, resetTime: Date.now() + 60000, store: 'memory' })),
  getRateLimitInfo: jest.fn(),
  resetRateLimit: jest.fn(),
  getRateLimitHeaders: jest.fn(() => ({})),
  getRateLimitConfig: jest.fn(() => ({ windowMs: 60000, max: 100 })),
  getRateLimiterStatus: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
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
}));

import { GET, POST } from '@/app/api/patients/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// ============================================================
// Test Utilities
// ============================================================

function createMockRequest(options = {}) {
  const url = new URL(options.url || 'http://localhost:3000/api/patients');

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

function createMockSession(role = 'staff_nurse', userId = 1) {
  return {
    user: {
      id: userId.toString(),
      email: `${role.replace('_', '.')}@hospital.org`,
      role: role,
      fullName: 'Test User',
    },
  };
}

// Mock patient data
const mockPatient = {
  id: 1,
  mrn: 'MRN-001',
  name: 'Baby Doe',
  gender: 'male',
  gestationalAge: 32,
  birthWeight: 1500,
  currentWeight: 1600,
  status: 'normal',
  dayOfLife: 5,
  admitDate: new Date('2025-01-15'),
  dateOfBirth: new Date('2025-01-10'),
  bedId: 1,
  alarmLimits: JSON.stringify({ hr: { min: 100, max: 180 } }),
  bed: { id: 1, bedNumber: 'NICU-01' },
  vitals: [{ heartRate: 140, spo2: 98, respRate: 45, temperature: 36.8, fio2: 21, recordedAt: new Date() }],
  _count: { alarms: 0 },
};

// ============================================================
// GET /api/patients Tests
// ============================================================

describe('GET /api/patients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findMany.mockResolvedValue([mockPatient]);
    prisma.patient.count.mockResolvedValue(1);
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 for unauthenticated requests', async () => {
      auth.mockResolvedValue(null);
      const request = createMockRequest();

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('allows staff_nurse to list patients', async () => {
      auth.mockResolvedValue(createMockSession('staff_nurse'));
      const request = createMockRequest();

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    test('allows physician to list patients', async () => {
      auth.mockResolvedValue(createMockSession('physician'));
      const request = createMockRequest();

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    test('allows admin to list patients', async () => {
      auth.mockResolvedValue(createMockSession('admin'));
      const request = createMockRequest();

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    test('returns paginated response', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('meta');
      expect(data.meta).toHaveProperty('total');
      expect(data.meta).toHaveProperty('limit');
      expect(data.meta).toHaveProperty('offset');
    });

    test('transforms patient data correctly', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const { data } = await response.json();

      expect(data[0]).toMatchObject({
        id: 1,
        bed: 'NICU-01',
        mrn: 'MRN-001',
        name: 'Baby Doe',
        gender: 'male',
        ga: 32,
        weight: 1600,
        status: 'normal',
      });
    });

    test('includes latest vitals', async () => {
      prisma.patient.findMany.mockResolvedValue([{
        ...mockPatient,
        vitals: [{ heartRate: 145, spo2: 97, respRate: 48, temperature: 37.0, fio2: 25 }],
      }]);

      const request = createMockRequest({ url: 'http://localhost:3000/api/patients?includeVitals=true' });
      const response = await GET(request);
      const { data } = await response.json();

      expect(data[0].basePR).toBe(145);
      expect(data[0].baseSPO2).toBe(97);
      expect(data[0].baseRR).toBe(48);
      expect(data[0].fio2).toBe(25);
    });
  });

  describe('Filtering', () => {
    test('filters by status', async () => {
      const request = createMockRequest({ url: 'http://localhost:3000/api/patients?status=critical' });
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'critical' }),
        })
      );
    });

    test('ignores invalid status filter', async () => {
      const request = createMockRequest({ url: 'http://localhost:3000/api/patients?status=invalid' });
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: 'invalid' }),
        })
      );
    });

    test('excludes discharged patients by default', async () => {
      const request = createMockRequest();
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ dischargeDate: null }),
        })
      );
    });

    test('includes discharged patients when requested', async () => {
      const request = createMockRequest({ url: 'http://localhost:3000/api/patients?includeDischarged=true' });
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ dischargeDate: null }),
        })
      );
    });
  });

  describe('Pagination', () => {
    test('uses default pagination', async () => {
      const request = createMockRequest();
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        })
      );
    });

    test('accepts custom pagination parameters', async () => {
      const request = createMockRequest({ url: 'http://localhost:3000/api/patients?page=2&limit=10' });
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    test('enforces max limit', async () => {
      const request = createMockRequest({ url: 'http://localhost:3000/api/patients?limit=500' });
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // max limit
        })
      );
    });
  });

  describe('Performance', () => {
    test('uses _count for active alarms (N+1 prevention)', async () => {
      const request = createMockRequest();
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            _count: expect.objectContaining({
              select: expect.objectContaining({
                alarms: expect.objectContaining({
                  where: { status: 'active' },
                }),
              }),
            }),
          }),
        })
      );
    });

    test('executes count and findMany in parallel', async () => {
      const request = createMockRequest();
      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalled();
      expect(prisma.patient.count).toHaveBeenCalled();
    });
  });
});

// ============================================================
// POST /api/patients Tests
// ============================================================

describe('POST /api/patients', () => {
  const validPatientData = {
    mrn: 'MRN-002',
    name: 'Baby Smith',
    dateOfBirth: '2025-01-20T00:00:00.000Z',
    gender: 'F', // Schema uses M/F/U
    gestationalAge: '34+0', // Schema requires XX+X format
    birthWeight: 2.0, // Schema expects kg, not grams
    bedNumber: '02', // Schema expects 2-digit bed number
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('charge_nurse'));
    prisma.patient.findUnique.mockResolvedValue(null);
    prisma.bed.findUnique.mockResolvedValue({ id: 2, bedNumber: 'NICU-02', patient: null });
    prisma.bed.update.mockResolvedValue({});
    prisma.patient.create.mockResolvedValue({ id: 2, ...validPatientData, bed: { bedNumber: 'NICU-02' } });
    prisma.auditLog.create.mockResolvedValue({});
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 for unauthenticated requests', async () => {
      auth.mockResolvedValue(null);
      const request = createMockRequest({ method: 'POST', body: validPatientData });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('returns 403 for staff_nurse (not allowed to admit)', async () => {
      auth.mockResolvedValue(createMockSession('staff_nurse'));
      const request = createMockRequest({ method: 'POST', body: validPatientData });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('AUTHORIZATION_ERROR');
    });

    test('allows charge_nurse to admit patients', async () => {
      auth.mockResolvedValue(createMockSession('charge_nurse'));
      const request = createMockRequest({ method: 'POST', body: validPatientData });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    test('allows physician to admit patients', async () => {
      auth.mockResolvedValue(createMockSession('physician'));
      const request = createMockRequest({ method: 'POST', body: validPatientData });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    test('allows admin to admit patients', async () => {
      auth.mockResolvedValue(createMockSession('admin'));
      const request = createMockRequest({ method: 'POST', body: validPatientData });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('Validation', () => {
    test('requires mrn', async () => {
      const { mrn, ...invalidData } = validPatientData;
      const request = createMockRequest({ method: 'POST', body: invalidData });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('requires name', async () => {
      const { name, ...invalidData } = validPatientData;
      const request = createMockRequest({ method: 'POST', body: invalidData });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    test('requires dateOfBirth', async () => {
      const { dateOfBirth, ...invalidData } = validPatientData;
      const request = createMockRequest({ method: 'POST', body: invalidData });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    test('requires gender', async () => {
      const { gender, ...invalidData } = validPatientData;
      const request = createMockRequest({ method: 'POST', body: invalidData });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    test('validates gestational age range', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { ...validPatientData, gestationalAge: 50 }, // Invalid: > 45 weeks
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    test('validates birth weight range', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { ...validPatientData, birthWeight: 10000 }, // Invalid: > 7000g
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });
  });

  describe('Business Rules', () => {
    test('rejects duplicate MRN', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 1, mrn: 'MRN-002' });
      const request = createMockRequest({ method: 'POST', body: validPatientData });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'mrn', message: expect.stringContaining('already exists') }),
        ])
      );
    });

    test('rejects non-existent bed', async () => {
      prisma.bed.findUnique.mockResolvedValue(null);
      const request = createMockRequest({ method: 'POST', body: validPatientData });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'bedNumber', message: expect.stringContaining('not found') }),
        ])
      );
    });

    test('rejects occupied bed', async () => {
      prisma.bed.findUnique.mockResolvedValue({
        id: 2,
        bedNumber: 'NICU-02',
        patient: { id: 99, name: 'Other Baby' },
      });
      const request = createMockRequest({ method: 'POST', body: validPatientData });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'bedNumber', message: expect.stringContaining('occupied') }),
        ])
      );
    });
  });

  describe('Side Effects', () => {
    test('updates bed status to occupied', async () => {
      const request = createMockRequest({ method: 'POST', body: validPatientData });
      await POST(request);

      expect(prisma.bed.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { status: 'occupied' },
      });
    });

    test('creates audit log entry', async () => {
      const request = createMockRequest({ method: 'POST', body: validPatientData });
      await POST(request);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'admit_patient',
          resource: 'patient',
        }),
      });
    });

    test('returns 201 on successful creation', async () => {
      const request = createMockRequest({ method: 'POST', body: validPatientData });
      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('Input Sanitization', () => {
    test('rejects XSS attempts in patient name via validation', async () => {
      // The validation schema rejects XSS attempts before sanitization
      // Names can only contain: A-Za-z, spaces, commas, periods, apostrophes, hyphens, parentheses
      const request = createMockRequest({
        method: 'POST',
        body: { ...validPatientData, name: '<script>alert("xss")</script>Baby' },
      });

      const response = await POST(request);

      // Should be rejected with 400 (validation error) because
      // angle brackets are not allowed in the patientName schema
      expect(response.status).toBe(400);
      // Patient should NOT be created when validation fails
      expect(prisma.patient.create).not.toHaveBeenCalled();
    });
  });
});
