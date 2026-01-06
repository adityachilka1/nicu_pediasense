/**
 * Flowsheet API Route Tests
 * Tests for /api/flowsheet routes including GET and POST operations
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
    flowsheetEntry: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

import { GET, POST } from '@/app/api/flowsheet/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// ============================================================
// Test Utilities
// ============================================================

function createMockRequest(options = {}) {
  const url = new URL(options.url || 'http://localhost:3000/api/flowsheet');

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

const mockFlowsheetEntry = {
  id: 1,
  patientId: 1,
  shiftDate: new Date('2024-01-01T00:00:00.000Z'),
  hour: 12,
  // Intake
  ivFluids: 10,
  tpn: 15,
  lipids: 5,
  bloodProducts: 0,
  medications: 2,
  enteral: 30,
  // Output
  urine: 20,
  stool: 5,
  emesis: 0,
  gastricOutput: 0,
  ostomyOutput: 0,
  drainOutput: 0,
  // Characteristics
  stoolCount: 1,
  stoolType: 'normal',
  urineCount: 2,
  specificGravity: 1.010,
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
// GET /api/flowsheet Tests
// ============================================================

describe('GET /api/flowsheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch flowsheet entries for a patient successfully', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findMany.mockResolvedValue([mockFlowsheetEntry]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(1);
    expect(data.data[0].shiftDate).toBe('2024-01-01');
    expect(data.data[0].hour).toBe(12);
    expect(data.meta.ioSummary).toBeDefined();
  });

  it('should require patientId parameter', async () => {
    auth.mockResolvedValue(createMockSession());

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet',
    });

    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('should validate patientId is numeric', async () => {
    auth.mockResolvedValue(createMockSession());

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=invalid',
    });

    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('should reject request for non-existent patient', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(null);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=999',
    });

    const response = await GET(request);
    expect(response.status).toBe(404);
  });

  it('should filter by specific date', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findMany.mockResolvedValue([mockFlowsheetEntry]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=1&date=2024-01-01',
    });

    await GET(request);

    expect(prisma.flowsheetEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: 1,
          shiftDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  it('should filter by date range', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findMany.mockResolvedValue([mockFlowsheetEntry]);

    const startDate = '2024-01-01T00:00:00.000Z';
    const endDate = '2024-01-02T00:00:00.000Z';

    const request = createMockRequest({
      url: `http://localhost:3000/api/flowsheet?patientId=1&startDate=${startDate}&endDate=${endDate}`,
    });

    await GET(request);

    expect(prisma.flowsheetEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shiftDate: expect.objectContaining({
            gte: new Date(startDate),
            lte: new Date(endDate),
          }),
        }),
      })
    );
  });

  it('should default to last 24 hours when no date specified', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findMany.mockResolvedValue([mockFlowsheetEntry]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=1',
    });

    await GET(request);

    expect(prisma.flowsheetEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shiftDate: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      })
    );
  });

  it('should calculate intake/output summary', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findMany.mockResolvedValue([mockFlowsheetEntry]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.meta.ioSummary).toBeDefined();
    expect(data.meta.ioSummary.totalIntake).toBeGreaterThan(0);
    expect(data.meta.ioSummary.totalOutput).toBeGreaterThan(0);
    expect(data.meta.ioSummary.netBalance).toBeDefined();
  });

  it('should sort entries by date and hour', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findMany.mockResolvedValue([mockFlowsheetEntry]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=1',
    });

    await GET(request);

    expect(prisma.flowsheetEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { shiftDate: 'asc' },
          { hour: 'asc' },
        ],
      })
    );
  });
});

// ============================================================
// POST /api/flowsheet Tests
// ============================================================

describe('POST /api/flowsheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new flowsheet entry successfully', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findUnique.mockResolvedValue(null); // no existing entry
    prisma.flowsheetEntry.create.mockResolvedValue(mockFlowsheetEntry);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        ivFluids: 10,
        tpn: 15,
        urine: 20,
        stool: 5,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.id).toBe(1);
    expect(data.meta.isUpdate).toBe(false);
    expect(prisma.flowsheetEntry.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('should update existing flowsheet entry (upsert)', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findUnique.mockResolvedValue(mockFlowsheetEntry);
    prisma.flowsheetEntry.update.mockResolvedValue({
      ...mockFlowsheetEntry,
      ivFluids: 15,
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        ivFluids: 15, // update value
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.isUpdate).toBe(true);
    expect(prisma.flowsheetEntry.update).toHaveBeenCalled();
    expect(prisma.flowsheetEntry.create).not.toHaveBeenCalled();
  });

  it('should validate hour range (0-23)', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 25, // invalid
        ivFluids: 10,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should validate volume ranges for intake', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    // Test ivFluids exceeding max
    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        ivFluids: 600, // exceeds max of 500
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should validate volume ranges for output', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        urine: 600, // exceeds max of 500
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should validate stoolType enum values', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findUnique.mockResolvedValue(null);
    prisma.flowsheetEntry.create.mockResolvedValue(mockFlowsheetEntry);
    prisma.auditLog.create.mockResolvedValue({});

    const validTypes = ['meconium', 'transitional', 'normal', 'loose', 'watery'];

    for (const type of validTypes) {
      jest.clearAllMocks();

      const request = createMockRequest({
        method: 'POST',
        body: {
          patientId: 1,
          shiftDate: '2024-01-01',
          hour: 12,
          stool: 5,
          stoolType: type,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    }
  });

  it('should reject invalid stoolType', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        stool: 5,
        stoolType: 'invalid_type',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should validate specificGravity range', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        urine: 20,
        specificGravity: 1.05, // exceeds max of 1.04
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
        shiftDate: '2024-01-01',
        hour: 12,
        ivFluids: 10,
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
        shiftDate: '2024-01-01',
        hour: 12,
        ivFluids: 10,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('should validate shiftDate format', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: 'invalid-date',
        hour: 12,
        ivFluids: 10,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle all null values for optional fields', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findUnique.mockResolvedValue(null);
    prisma.flowsheetEntry.create.mockResolvedValue({
      ...mockFlowsheetEntry,
      ivFluids: null,
      tpn: null,
      urine: null,
      stool: null,
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('should calculate total intake and output', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findUnique.mockResolvedValue(null);
    prisma.flowsheetEntry.create.mockResolvedValue(mockFlowsheetEntry);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        ivFluids: 10,
        tpn: 15,
        enteral: 30,
        urine: 20,
        stool: 5,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    // mockFlowsheetEntry has: ivFluids:10 + tpn:15 + lipids:5 + medications:2 + enteral:30 = 62
    expect(data.data.totalIntake).toBe(62);
    expect(data.data.totalOutput).toBe(25); // 20 + 5
  });

  it('should preserve existing values on update when not provided', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findUnique.mockResolvedValue(mockFlowsheetEntry);
    prisma.flowsheetEntry.update.mockResolvedValue(mockFlowsheetEntry);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        ivFluids: 15, // only update this field
      },
    });

    await POST(request);

    expect(prisma.flowsheetEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ivFluids: 15,
          tpn: mockFlowsheetEntry.tpn, // should preserve existing value
        }),
      })
    );
  });
});

// ============================================================
// Edge Cases and Clinical Validation Tests
// ============================================================

describe('Flowsheet API - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle negative values gracefully', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        ivFluids: -10, // negative value
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle zero values', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findUnique.mockResolvedValue(null);
    prisma.flowsheetEntry.create.mockResolvedValue({
      ...mockFlowsheetEntry,
      ivFluids: 0,
      urine: 0,
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        shiftDate: '2024-01-01',
        hour: 12,
        ivFluids: 0,
        urine: 0,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('should handle multiple entries for different hours', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findUnique.mockResolvedValue(null);
    prisma.flowsheetEntry.create.mockResolvedValue(mockFlowsheetEntry);
    prisma.auditLog.create.mockResolvedValue({});

    const hours = [0, 6, 12, 18];

    for (const hour of hours) {
      jest.clearAllMocks();

      const request = createMockRequest({
        method: 'POST',
        body: {
          patientId: 1,
          shiftDate: '2024-01-01',
          hour,
          ivFluids: 10,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    }
  });

  it('should calculate mL/kg/day for intake and output', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findMany.mockResolvedValue([mockFlowsheetEntry]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.meta.ioSummary.intakeMlPerKg).toBeDefined();
    expect(data.meta.ioSummary.outputMlPerKg).toBeDefined();
  });

  it('should calculate urine output in mL/kg/hr', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.flowsheetEntry.findMany.mockResolvedValue([mockFlowsheetEntry]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.meta.ioSummary.urineOutputMlPerKgPerHr).toBeDefined();
  });

  it('should handle large number of entries efficiently', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue(mockPatient);

    // Create 24 entries (full day)
    const entries = Array.from({ length: 24 }, (_, i) => ({
      ...mockFlowsheetEntry,
      id: i + 1,
      hour: i,
    }));

    prisma.flowsheetEntry.findMany.mockResolvedValue(entries);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data).toHaveLength(24);
    expect(data.meta.ioSummary.hoursRecorded).toBe(24);
  });

  it('should handle summary with no patient weight', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.patient.findUnique.mockResolvedValue({
      ...mockPatient,
      currentWeight: null,
    });
    prisma.flowsheetEntry.findMany.mockResolvedValue([mockFlowsheetEntry]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/flowsheet?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.meta.ioSummary).toBeDefined();
    // Should still calculate totals, just not per kg values
  });
});
