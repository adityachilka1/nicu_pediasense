/**
 * Vitals API Route Tests
 * Tests for GET /api/vitals and POST /api/vitals/simulate
 */

// Mock next/server
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
    },
    vital: {
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

import { GET, POST } from '@/app/api/vitals/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import {
  createMockSession,
  createMockRequest,
  createMockPatient,
  createMockVital,
  expectErrorResponse,
  expectSuccessResponse,
} from '../helpers/setup';

// ============================================================
// GET /api/vitals Tests
// ============================================================

describe('GET /api/vitals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('staff_nurse'));
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 for unauthenticated requests', async () => {
      auth.mockResolvedValue(null);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expectErrorResponse(data, 401, 'AUTHENTICATION_ERROR');
    });

    test('allows staff_nurse to view vitals', async () => {
      auth.mockResolvedValue(createMockSession('staff_nurse'));
      prisma.patient.findMany.mockResolvedValue([]);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    test('allows physician to view vitals', async () => {
      auth.mockResolvedValue(createMockSession('physician'));
      prisma.patient.findMany.mockResolvedValue([]);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    test('allows admin to view vitals', async () => {
      auth.mockResolvedValue(createMockSession('admin'));
      prisma.patient.findMany.mockResolvedValue([]);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Query Behavior', () => {
    test('fetches only admitted patients (no discharge date)', async () => {
      prisma.patient.findMany.mockResolvedValue([]);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            dischargeDate: null,
          },
        })
      );
    });

    test('includes bed information', async () => {
      prisma.patient.findMany.mockResolvedValue([]);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            bed: true,
          }),
        })
      );
    });

    test('fetches only latest vital per patient', async () => {
      prisma.patient.findMany.mockResolvedValue([]);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      await GET(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            vitals: {
              orderBy: { recordedAt: 'desc' },
              take: 1,
            },
          }),
        })
      );
    });
  });

  describe('Response Format', () => {
    test('returns vitals map keyed by patient ID', async () => {
      const mockPatient = createMockPatient({
        id: 1,
        vitals: [createMockVital({ heartRate: 145, spo2: 97 })],
      });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('1');
      expect(data.data['1']).toMatchObject({
        pr: 145,
        spo2: 97,
      });
    });

    test('formats vitals correctly with all parameters', async () => {
      const vital = createMockVital({
        heartRate: 145,
        spo2: 97,
        respRate: 48,
        temperature: 37.2,
        fio2: 25,
        pi: 3.5,
        recordedAt: new Date('2025-01-20T10:30:00Z'),
      });
      const mockPatient = createMockPatient({
        id: 1,
        vitals: [vital],
      });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data['1']).toMatchObject({
        pr: 145,
        spo2: 97,
        rr: 48,
        temp: '37.2',
        fio2: 25,
        pi: '3.5',
        recordedAt: vital.recordedAt.toISOString(),
      });
    });

    test('handles patients with no vitals using placeholders', async () => {
      const mockPatient = createMockPatient({
        id: 1,
        vitals: [],
      });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data['1']).toMatchObject({
        pr: '--',
        spo2: '--',
        rr: '--',
        temp: '--',
        fio2: '--',
        pi: '--',
      });
      expect(data.data['1']).not.toHaveProperty('recordedAt');
    });

    test('handles missing vital parameters gracefully', async () => {
      const vital = createMockVital({
        heartRate: null,
        spo2: null,
        respRate: 48,
        temperature: null,
        fio2: null,
        pi: null,
      });
      const mockPatient = createMockPatient({
        id: 1,
        vitals: [vital],
      });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data['1']).toMatchObject({
        pr: '--',
        spo2: '--',
        rr: 48,
        temp: '--',
        fio2: '--',
        pi: '--',
      });
    });

    test('includes metadata with patient count and timestamp', async () => {
      const mockPatients = [
        createMockPatient({ id: 1 }),
        createMockPatient({ id: 2 }),
        createMockPatient({ id: 3 }),
      ];
      prisma.patient.findMany.mockResolvedValue(mockPatients);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.meta).toMatchObject({
        patientCount: 3,
        timestamp: expect.any(String),
      });
    });
  });

  describe('Multiple Patients', () => {
    test('returns vitals for multiple patients', async () => {
      const mockPatients = [
        createMockPatient({
          id: 1,
          vitals: [createMockVital({ heartRate: 140 })],
        }),
        createMockPatient({
          id: 2,
          vitals: [createMockVital({ heartRate: 150 })],
        }),
        createMockPatient({
          id: 3,
          vitals: [createMockVital({ heartRate: 160 })],
        }),
      ];
      prisma.patient.findMany.mockResolvedValue(mockPatients);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(Object.keys(data.data)).toHaveLength(3);
      expect(data.data['1'].pr).toBe(140);
      expect(data.data['2'].pr).toBe(150);
      expect(data.data['3'].pr).toBe(160);
    });

    test('handles empty patient list', async () => {
      prisma.patient.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual({});
      expect(data.meta.patientCount).toBe(0);
    });
  });

  describe('Temperature Formatting', () => {
    test('formats temperature to 1 decimal place', async () => {
      const vital = createMockVital({ temperature: 37.12345 });
      const mockPatient = createMockPatient({
        id: 1,
        vitals: [vital],
      });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data['1'].temp).toBe('37.1');
    });
  });

  describe('PI Formatting', () => {
    test('formats PI to 1 decimal place', async () => {
      const vital = createMockVital({ pi: 3.56789 });
      const mockPatient = createMockPatient({
        id: 1,
        vitals: [vital],
      });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data['1'].pi).toBe('3.6');
    });
  });
});

// ============================================================
// POST /api/vitals/simulate Tests
// ============================================================

describe('POST /api/vitals/simulate', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findMany.mockResolvedValue([]);
    prisma.vital.create.mockResolvedValue(createMockVital());
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 for unauthenticated requests', async () => {
      auth.mockResolvedValue(null);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expectErrorResponse(data, 401, 'AUTHENTICATION_ERROR');
    });

    test('allows authenticated users to simulate vitals in development', async () => {
      process.env.NODE_ENV = 'development';
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Environment Restrictions', () => {
    test('blocks simulation in production environment', async () => {
      process.env.NODE_ENV = 'production';
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('AUTHORIZATION_ERROR');
      expect(data.error.message).toContain('not available in production');
    });

    test('allows simulation in development environment', async () => {
      process.env.NODE_ENV = 'development';
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    test('allows simulation in test environment', async () => {
      process.env.NODE_ENV = 'test';
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Simulation Logic', () => {
    test('generates vitals for all admitted patients', async () => {
      const mockPatients = [
        createMockPatient({ id: 1, status: 'normal' }),
        createMockPatient({ id: 2, status: 'warning' }),
        createMockPatient({ id: 3, status: 'critical' }),
      ];
      prisma.patient.findMany.mockResolvedValue(mockPatients);
      prisma.vital.create.mockResolvedValue(createMockVital());

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      await POST(request);

      expect(prisma.vital.create).toHaveBeenCalledTimes(3);
    });

    test('queries only admitted patients (no discharge date)', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      await POST(request);

      expect(prisma.patient.findMany).toHaveBeenCalledWith({
        where: { dischargeDate: null },
      });
    });

    test('creates vitals with simulator source', async () => {
      const mockPatient = createMockPatient({ id: 1, status: 'normal' });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      await POST(request);

      expect(prisma.vital.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'simulator',
          }),
        })
      );
    });

    test('generates different values based on patient status (normal)', async () => {
      const mockPatient = createMockPatient({ id: 1, status: 'normal' });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      await POST(request);

      const call = prisma.vital.create.mock.calls[0][0];
      const vitalData = call.data;

      // Normal patients should have vitals around these base values
      expect(vitalData.heartRate).toBeGreaterThanOrEqual(136);
      expect(vitalData.heartRate).toBeLessThanOrEqual(144);
      expect(vitalData.spo2).toBeGreaterThanOrEqual(94);
      expect(vitalData.spo2).toBeLessThanOrEqual(98);
      expect(vitalData.fio2).toBe(21);
    });

    test('generates different values based on patient status (warning)', async () => {
      const mockPatient = createMockPatient({ id: 1, status: 'warning' });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      await POST(request);

      const call = prisma.vital.create.mock.calls[0][0];
      const vitalData = call.data;

      // Warning patients should have vitals around these base values
      expect(vitalData.heartRate).toBeGreaterThanOrEqual(154);
      expect(vitalData.heartRate).toBeLessThanOrEqual(166);
      expect(vitalData.spo2).toBeGreaterThanOrEqual(84);
      expect(vitalData.spo2).toBeLessThanOrEqual(96);
      expect(vitalData.fio2).toBe(35);
    });

    test('generates different values based on patient status (critical)', async () => {
      const mockPatient = createMockPatient({ id: 1, status: 'critical' });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      await POST(request);

      const call = prisma.vital.create.mock.calls[0][0];
      const vitalData = call.data;

      // Critical patients should have vitals around these base values
      expect(vitalData.heartRate).toBeGreaterThanOrEqual(170);
      expect(vitalData.heartRate).toBeLessThanOrEqual(190);
      expect(vitalData.spo2).toBeGreaterThanOrEqual(74);
      expect(vitalData.spo2).toBeLessThanOrEqual(94);
      expect(vitalData.fio2).toBe(55);
    });

    test('generates vitals within valid ranges', async () => {
      const mockPatient = createMockPatient({ id: 1, status: 'normal' });
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      await POST(request);

      const call = prisma.vital.create.mock.calls[0][0];
      const vitalData = call.data;

      // Ensure SpO2 is within 70-100%
      expect(vitalData.spo2).toBeGreaterThanOrEqual(70);
      expect(vitalData.spo2).toBeLessThanOrEqual(100);

      // Ensure temperature is realistic
      expect(vitalData.temperature).toBeGreaterThanOrEqual(36.0);
      expect(vitalData.temperature).toBeLessThanOrEqual(38.0);

      // Ensure PI is within valid range
      expect(vitalData.pi).toBeGreaterThanOrEqual(0.5);
      expect(vitalData.pi).toBeLessThanOrEqual(4.5);
    });
  });

  describe('Response Format', () => {
    test('returns success message with count', async () => {
      const mockPatients = [
        createMockPatient({ id: 1 }),
        createMockPatient({ id: 2 }),
      ];
      prisma.patient.findMany.mockResolvedValue(mockPatients);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('Generated vitals for 2 patients');
    });

    test('returns array of created vital records', async () => {
      const mockPatients = [
        createMockPatient({ id: 1 }),
        createMockPatient({ id: 2 }),
      ];
      prisma.patient.findMany.mockResolvedValue(mockPatients);
      prisma.vital.create.mockResolvedValueOnce(createMockVital({ id: 10, patientId: 1 }));
      prisma.vital.create.mockResolvedValueOnce(createMockVital({ id: 11, patientId: 2 }));

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data).toHaveLength(2);
      expect(data.data).toEqual([
        { patientId: 1, vitalId: 10 },
        { patientId: 2, vitalId: 11 },
      ]);
    });

    test('handles empty patient list', async () => {
      prisma.patient.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/vitals/simulate',
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('Generated vitals for 0 patients');
      expect(data.data).toHaveLength(0);
    });
  });
});
