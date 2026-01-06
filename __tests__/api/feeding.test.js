/**
 * Feeding API Route Tests
 * Tests for /api/feeding routes including GET and POST operations
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
    feedingLog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
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

import { GET, POST } from '@/app/api/feeding/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// ============================================================
// Test Utilities
// ============================================================

function createMockRequest(options = {}) {
  const url = new URL(options.url || 'http://localhost:3000/api/feeding');

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

function createMockSession(role = 'staff_nurse') {
  return {
    user: {
      id: '1',
      email: 'test@example.com',
      name: 'Test Nurse',
      role,
    },
  };
}

const mockFeedingLog = {
  id: 1,
  patientId: 1,
  feedingType: 'BREAST_MILK',
  route: 'ORAL',
  volumeOrdered: 50,
  volumeGiven: 45,
  volumeResidual: 0,
  residualColor: null,
  tolerance: 'GOOD',
  emesis: false,
  emesisAmount: null,
  fortified: false,
  calories: null,
  notes: null,
  recordedBy: 'Test Nurse',
  recordedAt: new Date('2024-01-01T12:00:00.000Z'),
};

const mockPatient = {
  id: 1,
  mrn: 'MRN001',
  name: 'Baby Smith',
  currentWeight: 2.5,
  dayOfLife: 5,
};

// ============================================================
// GET /api/feeding Tests
// ============================================================

describe('GET /api/feeding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch feeding logs for a patient successfully', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.findMany.mockResolvedValue([mockFeedingLog]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(1);
    expect(data.data[0].feedingType).toBe('BREAST_MILK');
    expect(data.meta.patientId).toBe(1);
    expect(data.meta.summary24h).toBeDefined();
  });

  it('should require patientId parameter', async () => {
    auth.mockResolvedValue(createMockSession());

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding',
    });

    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('should validate patientId is numeric', async () => {
    auth.mockResolvedValue(createMockSession());

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding?patientId=invalid',
    });

    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('should reject request for non-existent patient', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(null);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding?patientId=999',
    });

    const response = await GET(request);
    expect(response.status).toBe(404);
  });

  it('should filter by feeding type with lowercase to uppercase mapping', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.findMany.mockResolvedValue([mockFeedingLog]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding?patientId=1&feedingType=breast',
    });

    await GET(request);

    expect(prisma.feedingLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          feedingType: 'BREAST_MILK', // lowercase 'breast' should map to 'BREAST_MILK'
        }),
      })
    );
  });

  it('should filter by date range', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.findMany.mockResolvedValue([mockFeedingLog]);

    const startDate = '2024-01-01T00:00:00.000Z';
    const endDate = '2024-01-02T00:00:00.000Z';

    const request = createMockRequest({
      url: `http://localhost:3000/api/feeding?patientId=1&startDate=${startDate}&endDate=${endDate}`,
    });

    await GET(request);

    expect(prisma.feedingLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recordedAt: expect.objectContaining({
            gte: new Date(startDate),
            lte: new Date(endDate),
          }),
        }),
      })
    );
  });

  it('should respect limit parameter', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.findMany.mockResolvedValue([mockFeedingLog]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding?patientId=1&limit=25',
    });

    await GET(request);

    expect(prisma.feedingLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
      })
    );
  });

  it('should cap limit at 100', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.findMany.mockResolvedValue([mockFeedingLog]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding?patientId=1&limit=500',
    });

    await GET(request);

    expect(prisma.feedingLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100, // should be capped
      })
    );
  });

  it('should calculate 24h feeding summary', async () => {
    const now = new Date();
    const recent = {
      ...mockFeedingLog,
      recordedAt: now,
    };

    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.findMany.mockResolvedValue([recent]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.meta.summary24h).toBeDefined();
    expect(data.meta.summary24h.totalFeedings).toBe(1);
    expect(data.meta.summary24h.totalVolumeGiven).toBeGreaterThan(0);
  });
});

// ============================================================
// POST /api/feeding Tests
// ============================================================

describe('POST /api/feeding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new feeding log successfully', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue(mockFeedingLog);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'oral',
        volumeOrdered: 50,
        volumeGiven: 45,
        tolerance: 'good',
        emesis: false,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.id).toBe(1);
    expect(prisma.feedingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 1,
          feedingType: 'BREAST_MILK', // lowercase should map to uppercase
          route: 'ORAL',
          volumeOrdered: 50,
          volumeGiven: 45,
          tolerance: 'GOOD',
          emesis: false,
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('should map lowercase feedingType to uppercase enum', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue(mockFeedingLog);
    prisma.auditLog.create.mockResolvedValue({});

    const testCases = [
      { input: 'breast', expected: 'BREAST_MILK' },
      { input: 'formula', expected: 'FORMULA' },
      { input: 'fortified', expected: 'FORTIFIED_BREAST_MILK' },
      { input: 'tpn', expected: 'TPN' },
      { input: 'enteral', expected: 'MIXED' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();

      const request = createMockRequest({
        method: 'POST',
        body: {
          patientId: 1,
          feedingType: testCase.input,
          route: 'oral',
          volumeGiven: 45,
        },
      });

      await POST(request);

      expect(prisma.feedingLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            feedingType: testCase.expected,
          }),
        })
      );
    }
  });

  it('should map lowercase route to uppercase enum', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue(mockFeedingLog);
    prisma.auditLog.create.mockResolvedValue({});

    const testCases = [
      { input: 'oral', expected: 'ORAL' },
      { input: 'ng', expected: 'NG_TUBE' },
      { input: 'og', expected: 'OG_TUBE' },
      { input: 'gt', expected: 'GT_TUBE' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();

      const request = createMockRequest({
        method: 'POST',
        body: {
          patientId: 1,
          feedingType: 'breast',
          route: testCase.input,
          volumeGiven: 45,
        },
      });

      await POST(request);

      expect(prisma.feedingLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            route: testCase.expected,
          }),
        })
      );
    }
  });

  it('should map lowercase tolerance to uppercase enum', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue(mockFeedingLog);
    prisma.auditLog.create.mockResolvedValue({});

    const testCases = [
      { input: 'good', expected: 'GOOD' },
      { input: 'fair', expected: 'FAIR' },
      { input: 'poor', expected: 'POOR' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();

      const request = createMockRequest({
        method: 'POST',
        body: {
          patientId: 1,
          feedingType: 'breast',
          route: 'oral',
          volumeGiven: 45,
          tolerance: testCase.input,
        },
      });

      await POST(request);

      expect(prisma.feedingLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tolerance: testCase.expected,
          }),
        })
      );
    }
  });

  it('should validate volume ranges', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    // Test volumeGiven exceeding max
    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'oral',
        volumeGiven: 600, // exceeds max of 500
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should validate volumeResidual range', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'ng',
        volumeGiven: 45,
        volumeResidual: 250, // exceeds max of 200
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should require clinical staff role', async () => {
    auth.mockResolvedValue(createMockSession('administrative')); // wrong role

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'oral',
        volumeGiven: 45,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should reject invalid patient ID', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(null);

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 999,
        feedingType: 'breast',
        route: 'oral',
        volumeGiven: 45,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('should handle emesis with amount', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue({
      ...mockFeedingLog,
      emesis: true,
      emesisAmount: 10,
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'oral',
        volumeGiven: 45,
        emesis: true,
        emesisAmount: 10,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.data.emesis).toBe(true);
    expect(data.data.emesisAmount).toBe(10);
  });

  it('should null emesisAmount when emesis is false', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue(mockFeedingLog);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'oral',
        volumeGiven: 45,
        emesis: false,
        emesisAmount: 10, // should be nulled
      },
    });

    await POST(request);

    expect(prisma.feedingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emesis: false,
          emesisAmount: null, // should be null when emesis is false
        }),
      })
    );
  });

  it('should handle fortified feeding with calories', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue({
      ...mockFeedingLog,
      fortified: true,
      calories: 24,
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'fortified',
        route: 'oral',
        volumeGiven: 45,
        fortified: true,
        calories: 24,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.data.fortified).toBe(true);
    expect(data.data.calories).toBe(24);
  });

  it('should validate calories range', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'fortified',
        route: 'oral',
        volumeGiven: 45,
        fortified: true,
        calories: 60, // exceeds max of 50
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle residualColor as string (not enum)', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue({
      ...mockFeedingLog,
      volumeResidual: 5,
      residualColor: 'bilious',
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'ng',
        volumeGiven: 45,
        volumeResidual: 5,
        residualColor: 'bilious',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.data.residualColor).toBe('bilious');
  });

  it('should use custom recordedAt if provided', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue(mockFeedingLog);
    prisma.auditLog.create.mockResolvedValue({});

    const customDate = '2024-01-01T10:00:00.000Z';

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'oral',
        volumeGiven: 45,
        recordedAt: customDate,
      },
    });

    await POST(request);

    expect(prisma.feedingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recordedAt: new Date(customDate),
        }),
      })
    );
  });
});

// ============================================================
// Edge Cases and Clinical Validation Tests
// ============================================================

describe('Feeding API - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle negative volume values', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'oral',
        volumeGiven: -10, // negative value
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle zero volume values', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue({
      ...mockFeedingLog,
      volumeGiven: 0,
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'oral',
        volumeGiven: 0, // zero is valid
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('should handle multiple feeding types in query', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.findMany.mockResolvedValue([mockFeedingLog]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding?patientId=1&feedingType=breast',
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('should calculate summary with no feedings', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.findMany.mockResolvedValue([]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/feeding?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.meta.summary24h.totalFeedings).toBe(0);
    expect(data.meta.summary24h.totalVolumeGiven).toBe(0);
  });

  it('should handle null optional fields', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.feedingLog.create.mockResolvedValue({
      ...mockFeedingLog,
      volumeResidual: null,
      residualColor: null,
      tolerance: null,
      notes: null,
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        feedingType: 'breast',
        route: 'oral',
        volumeGiven: 45,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});
