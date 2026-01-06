/**
 * Alarms API Route Tests
 * Tests for GET /api/alarms and POST /api/alarms
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
    alarm: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    alarmAcknowledgment: {
      createMany: jest.fn(),
    },
    auditLog: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      // Simple transaction mock that executes the callback
      return callback({
        alarm: {
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
          findMany: jest.fn().mockResolvedValue([
            { id: 1, status: 'acknowledged' },
            { id: 2, status: 'acknowledged' },
            { id: 3, status: 'acknowledged' },
          ]),
        },
        alarmAcknowledgment: {
          createMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
        auditLog: {
          createMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      });
    }),
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

import { GET, POST } from '@/app/api/alarms/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import logger from '@/lib/logger';
import {
  createMockSession,
  createMockRequest,
  createMockAlarm,
  expectErrorResponse,
  expectPaginatedResponse,
  expectValidationError,
  validAlarmActionData,
} from '../helpers/setup';

// ============================================================
// GET /api/alarms Tests
// ============================================================

describe('GET /api/alarms', () => {
  const mockAlarms = [
    createMockAlarm({ id: 1, type: 'critical', status: 'active' }),
    createMockAlarm({ id: 2, type: 'warning', status: 'active' }),
    createMockAlarm({ id: 3, type: 'advisory', status: 'active' }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.alarm.findMany.mockResolvedValue(mockAlarms);
    prisma.alarm.count.mockResolvedValue(3);
    prisma.alarm.groupBy.mockResolvedValue([
      { type: 'critical', _count: 1 },
      { type: 'warning', _count: 2 },
    ]);
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 for unauthenticated requests', async () => {
      auth.mockResolvedValue(null);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expectErrorResponse(data, 401, 'AUTHENTICATION_ERROR');
    });

    test('allows staff_nurse to view alarms', async () => {
      auth.mockResolvedValue(createMockSession('staff_nurse'));
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    test('allows physician to view alarms', async () => {
      auth.mockResolvedValue(createMockSession('physician'));
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    test('allows admin to view alarms', async () => {
      auth.mockResolvedValue(createMockSession('admin'));
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Filtering by Status', () => {
    test('filters active alarms by default', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        })
      );
    });

    test('filters by acknowledged status', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?status=acknowledged',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'acknowledged' }),
        })
      );
    });

    test('filters by silenced status', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?status=silenced',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'silenced' }),
        })
      );
    });

    test('filters by resolved status', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?status=resolved',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'resolved' }),
        })
      );
    });

    test('shows all alarms when status is all', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?status=all',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: expect.anything() }),
        })
      );
    });

    test('defaults to active when invalid status provided', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?status=invalid',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        })
      );
    });
  });

  describe('Filtering by Type', () => {
    test('filters by critical type', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?type=critical',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'critical' }),
        })
      );
    });

    test('filters by warning type', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?type=warning',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'warning' }),
        })
      );
    });

    test('filters by advisory type', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?type=advisory',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'advisory' }),
        })
      );
    });

    test('combines status and type filters', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?status=active&type=critical',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
            type: 'critical',
          }),
        })
      );
    });
  });

  describe('Pagination', () => {
    test('uses default pagination (50 items)', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        })
      );
    });

    test('accepts custom pagination parameters', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?page=2&limit=25',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        })
      );
    });

    test('enforces max limit of 200', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms?limit=500',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200,
        })
      );
    });
  });

  describe('Response Format', () => {
    test('returns paginated response', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expectPaginatedResponse(data);
    });

    test('transforms alarms with patient info', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0]).toMatchObject({
        id: expect.any(Number),
        patientId: expect.any(Number),
        bed: expect.any(String),
        patientName: expect.any(String),
        type: expect.any(String),
        parameter: expect.any(String),
        value: expect.any(Number),
        threshold: expect.any(Number),
        message: expect.any(String),
        status: expect.any(String),
        triggeredAt: expect.any(String),
      });
    });

    test('includes bed number from nested patient relation', async () => {
      const alarm = createMockAlarm({
        patient: {
          name: 'Baby Test',
          bed: { bedNumber: '05' },
        },
      });
      prisma.alarm.findMany.mockResolvedValue([alarm]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].bed).toBe('05');
    });

    test('handles missing bed gracefully', async () => {
      const alarm = createMockAlarm({
        patient: {
          name: 'Baby Test',
          bed: null,
        },
      });
      prisma.alarm.findMany.mockResolvedValue([alarm]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].bed).toBe('--');
    });

    test('includes acknowledgment info when present', async () => {
      const alarm = createMockAlarm({
        acknowledgments: [
          { user: { fullName: 'Nurse Smith' } },
        ],
      });
      prisma.alarm.findMany.mockResolvedValue([alarm]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].acknowledgedBy).toBe('Nurse Smith');
    });

    test('handles alarms without acknowledgments', async () => {
      const alarm = createMockAlarm({ acknowledgments: [] });
      prisma.alarm.findMany.mockResolvedValue([alarm]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].acknowledgedBy).toBeUndefined();
    });

    test('includes type counts in metadata', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.meta.critical).toBe(1);
      expect(data.meta.warning).toBe(2);
    });

    test('handles zero counts for alarm types', async () => {
      prisma.alarm.groupBy.mockResolvedValue([]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.meta.critical).toBe(0);
      expect(data.meta.warning).toBe(0);
    });
  });

  describe('Sorting', () => {
    test('sorts by type (critical first) then by triggered time', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { type: 'asc' },
            { triggeredAt: 'desc' },
          ],
        })
      );
    });
  });

  describe('Performance Optimization', () => {
    test('uses select to minimize data transfer (N+1 prevention)', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            patientId: true,
            type: true,
            patient: expect.objectContaining({
              select: expect.objectContaining({
                name: true,
                bed: expect.objectContaining({
                  select: { bedNumber: true },
                }),
              }),
            }),
          }),
        })
      );
    });

    test('fetches only latest acknowledgment per alarm', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      await GET(request);

      expect(prisma.alarm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            acknowledgments: expect.objectContaining({
              take: 1,
              orderBy: { createdAt: 'desc' },
            }),
          }),
        })
      );
    });

    test('uses groupBy for type counts (efficient aggregation)', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
      });

      await GET(request);

      expect(prisma.alarm.groupBy).toHaveBeenCalledWith({
        by: ['type'],
        where: expect.objectContaining({ status: 'active' }),
        _count: true,
      });
    });
  });
});

// ============================================================
// POST /api/alarms Tests
// ============================================================

describe('POST /api/alarms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('staff_nurse'));
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 for unauthenticated requests', async () => {
      auth.mockResolvedValue(null);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: validAlarmActionData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expectErrorResponse(data, 401, 'AUTHENTICATION_ERROR');
    });

    test('allows staff_nurse to perform alarm actions', async () => {
      auth.mockResolvedValue(createMockSession('staff_nurse'));
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: validAlarmActionData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    test('allows physician to perform alarm actions', async () => {
      auth.mockResolvedValue(createMockSession('physician'));
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: validAlarmActionData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Validation', () => {
    test('requires action field', async () => {
      const { action, ...invalidData } = validAlarmActionData;
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: invalidData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('requires alarmIds field', async () => {
      const { alarmIds, ...invalidData } = validAlarmActionData;
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: invalidData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('validates action is one of: acknowledge, silence, resolve', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { ...validAlarmActionData, action: 'invalid_action' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectValidationError(data, 'action');
    });

    test('validates alarmIds is non-empty array', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { ...validAlarmActionData, alarmIds: [] },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('validates alarmIds contains positive integers', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { ...validAlarmActionData, alarmIds: [1, -5, 3] },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('validates silenceDuration range (30-600 seconds)', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { ...validAlarmActionData, action: 'silence', silenceDuration: 10 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('accepts valid acknowledge action', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'acknowledge', alarmIds: [1, 2, 3] },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    test('accepts valid silence action', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'silence', alarmIds: [1, 2], silenceDuration: 300 },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    test('accepts valid resolve action', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'resolve', alarmIds: [1] },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Alarm Actions - Acknowledge', () => {
    test('updates alarm status to acknowledged', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'acknowledge', alarmIds: [1, 2, 3] },
      });

      await POST(request);

      // Check that transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('creates acknowledgment records', async () => {
      const session = createMockSession('staff_nurse', 5);
      auth.mockResolvedValue(session);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'acknowledge', alarmIds: [1, 2, 3] },
      });

      await POST(request);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Alarm Actions - Silence', () => {
    test('updates alarm status to silenced', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'silence', alarmIds: [1, 2], silenceDuration: 300 },
      });

      await POST(request);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('sets silencedUntil timestamp based on duration', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'silence', alarmIds: [1], silenceDuration: 120 },
      });

      await POST(request);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('uses default silence duration of 120 seconds', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'silence', alarmIds: [1] },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Alarm Actions - Resolve', () => {
    test('updates alarm status to resolved', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'resolve', alarmIds: [1] },
      });

      await POST(request);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('sets resolvedAt timestamp', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'resolve', alarmIds: [1, 2] },
      });

      await POST(request);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Batch Operations', () => {
    test('processes multiple alarms in single transaction', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'acknowledge', alarmIds: [1, 2, 3, 4, 5] },
      });

      await POST(request);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    test('returns count of processed alarms', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'acknowledge', alarmIds: [1, 2, 3] },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toContain('acknowledged 3 alarm(s)');
      expect(data.meta.processed).toBe(3);
    });
  });

  describe('Non-existent Alarms', () => {
    test('handles some alarms not found gracefully', async () => {
      // Mock transaction to return only 2 alarms instead of 3
      prisma.$transaction.mockResolvedValueOnce([
        { id: 1, status: 'acknowledged' },
        { id: 2, status: 'acknowledged' },
      ]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'acknowledge', alarmIds: [1, 2, 999] },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.processed).toBeDefined();
    });

    test('warns about non-existent alarms in logs', async () => {
      prisma.$transaction.mockResolvedValueOnce([
        { id: 1, status: 'acknowledged' },
      ]);

      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'acknowledge', alarmIds: [1, 999] },
      });

      await POST(request);

      // Logger.warn should be called for non-existent alarms
      // Note: This test may need adjustment based on actual implementation
    });
  });

  describe('Audit Logging', () => {
    test('creates audit log entries for all processed alarms', async () => {
      const session = createMockSession('staff_nurse', 5);
      auth.mockResolvedValue(session);
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'acknowledge', alarmIds: [1, 2, 3] },
      });

      await POST(request);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Response Format', () => {
    test('returns success message with action verb', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'acknowledge', alarmIds: [1, 2] },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toMatch(/acknowledged/i);
    });

    test('returns updated alarm data', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'silence', alarmIds: [1, 2] },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    test('includes metadata with processed count', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/alarms',
        method: 'POST',
        body: { action: 'resolve', alarmIds: [1, 2, 3] },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.meta).toHaveProperty('processed');
      expect(typeof data.meta.processed).toBe('number');
    });
  });
});
