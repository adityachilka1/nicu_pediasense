/**
 * Discharge API Route Tests
 * Tests for /api/discharge routes including GET, POST, and PUT operations
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

// Mock prisma - define mock inline to avoid hoisting issues
jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    dischargePlan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    dischargeChecklistItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

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

import { GET, POST, PUT } from '@/app/api/discharge/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// ============================================================
// Test Utilities
// ============================================================

function createMockRequest(options = {}) {
  const url = new URL(options.url || 'http://localhost:3000/api/discharge');

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

function createMockSession(role = 'charge_nurse') {
  return {
    user: {
      id: '1',
      email: 'test@example.com',
      name: 'Test Nurse',
      role,
    },
  };
}

const mockChecklistItem = {
  id: 1,
  dischargePlanId: 1,
  category: 'MEDICAL_STABILITY',
  description: 'Stable temperature in open crib for 24+ hours',
  required: true,
  status: 'PENDING',
  orderIndex: 0,
  completedAt: null,
  completedById: null,
  notes: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const mockDischargePlan = {
  id: 1,
  patientId: 1,
  createdById: 1,
  estimatedDate: new Date('2024-02-01T00:00:00.000Z'),
  actualDate: null,
  disposition: 'home',
  primaryCaregiver: 'Jane Smith',
  caregiverPhone: '555-1234',
  status: 'PLANNING',
  readinessScore: 0,
  specialInstructions: null,
  followUpPlan: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  patient: {
    id: 1,
    mrn: 'MRN001',
    name: 'Baby Smith',
    gestationalAge: '32+4',
    dayOfLife: 30,
    status: 'normal',
  },
  createdBy: {
    id: 1,
    fullName: 'Dr. Jane Doe',
    initials: 'JD',
    role: 'physician',
  },
  checklistItems: [mockChecklistItem],
};

const mockPatient = {
  id: 1,
  mrn: 'MRN001',
  name: 'Baby Smith',
  status: 'normal',
};

// ============================================================
// GET /api/discharge Tests
// ============================================================

describe('GET /api/discharge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch discharge plans for a patient successfully', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([mockDischargePlan]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(1);
    expect(data.data[0].checklistStats).toBeDefined();
    expect(data.data[0].checklistStats.readinessScore).toBeDefined();
  });

  it('should filter by status with lowercase to uppercase mapping', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([mockDischargePlan]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1&status=planning',
    });

    await GET(request);

    expect(prisma.dischargePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PLANNING', // lowercase should map to uppercase
        }),
      })
    );
  });

  it('should calculate checklist statistics', async () => {
    const planWithMixedItems = {
      ...mockDischargePlan,
      checklistItems: [
        { ...mockChecklistItem, id: 1, status: 'PENDING', required: true },
        { ...mockChecklistItem, id: 2, status: 'COMPLETED', required: true },
        { ...mockChecklistItem, id: 3, status: 'IN_PROGRESS', required: false },
        { ...mockChecklistItem, id: 4, status: 'NOT_APPLICABLE', required: true },
      ],
    };

    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([planWithMixedItems]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data[0].checklistStats.total).toBe(4);
    expect(data.data[0].checklistStats.pending).toBe(1);
    expect(data.data[0].checklistStats.completed).toBe(1);
    expect(data.data[0].checklistStats.inProgress).toBe(1);
    expect(data.data[0].checklistStats.notApplicable).toBe(1);
  });

  it('should calculate readiness score based on required items', async () => {
    const planWithCompletedItems = {
      ...mockDischargePlan,
      checklistItems: [
        { ...mockChecklistItem, id: 1, status: 'COMPLETED', required: true },
        { ...mockChecklistItem, id: 2, status: 'COMPLETED', required: true },
        { ...mockChecklistItem, id: 3, status: 'PENDING', required: true },
        { ...mockChecklistItem, id: 4, status: 'PENDING', required: true },
      ],
    };

    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([planWithCompletedItems]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    // 2 out of 4 required items completed = 50%
    expect(data.data[0].checklistStats.readinessScore).toBe(50);
  });

  it('should count NOT_APPLICABLE items as completed for readiness', async () => {
    const planWithNAItems = {
      ...mockDischargePlan,
      checklistItems: [
        { ...mockChecklistItem, id: 1, status: 'COMPLETED', required: true },
        { ...mockChecklistItem, id: 2, status: 'NOT_APPLICABLE', required: true },
      ],
    };

    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([planWithNAItems]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    // Both items should count as complete
    expect(data.data[0].checklistStats.readinessScore).toBe(100);
  });

  it('should group checklist items by category', async () => {
    const planWithCategories = {
      ...mockDischargePlan,
      checklistItems: [
        { ...mockChecklistItem, id: 1, category: 'MEDICAL_STABILITY', status: 'COMPLETED', required: true },
        { ...mockChecklistItem, id: 2, category: 'MEDICAL_STABILITY', status: 'PENDING', required: true },
        { ...mockChecklistItem, id: 3, category: 'FAMILY_EDUCATION', status: 'COMPLETED', required: true },
      ],
    };

    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([planWithCategories]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data[0].checklistStats.byCategory).toBeDefined();
    expect(data.data[0].checklistStats.byCategory['MEDICAL_STABILITY']).toBeDefined();
    expect(data.data[0].checklistStats.byCategory['FAMILY_EDUCATION']).toBeDefined();
  });
});

// ============================================================
// POST /api/discharge Tests
// ============================================================

describe('POST /api/discharge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new discharge plan successfully', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.dischargePlan.findUnique.mockResolvedValue(null); // no existing plan

    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback({
        dischargePlan: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
          findUnique: jest.fn().mockResolvedValue(mockDischargePlan),
        },
        dischargeChecklistItem: {
          createMany: jest.fn().mockResolvedValue({ count: 10 }),
        },
      });
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        estimatedDate: '2024-02-01T00:00:00.000Z',
        disposition: 'home',
        primaryCaregiver: 'Jane Smith',
        caregiverPhone: '555-1234',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.id).toBe(1);
  });

  it('should create default checklist items when none provided', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.dischargePlan.findUnique.mockResolvedValue(null);

    const createManyMock = jest.fn().mockResolvedValue({ count: 24 });
    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback({
        dischargePlan: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
          findUnique: jest.fn().mockResolvedValue(mockDischargePlan),
        },
        dischargeChecklistItem: {
          createMany: createManyMock,
        },
      });
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        estimatedDate: '2024-02-01T00:00:00.000Z',
        disposition: 'home',
      },
    });

    await POST(request);

    expect(createManyMock).toHaveBeenCalled();
  });

  it('should use custom checklist items when provided', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.dischargePlan.findUnique.mockResolvedValue(null);

    const createManyMock = jest.fn().mockResolvedValue({ count: 2 });
    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback({
        dischargePlan: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
          findUnique: jest.fn().mockResolvedValue(mockDischargePlan),
        },
        dischargeChecklistItem: {
          createMany: createManyMock,
        },
      });
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        estimatedDate: '2024-02-01T00:00:00.000Z',
        checklistItems: [
          { category: 'medical', description: 'Custom item 1', required: true, orderIndex: 0 },
          { category: 'education', description: 'Custom item 2', required: true, orderIndex: 1 },
        ],
      },
    });

    await POST(request);

    expect(createManyMock).toHaveBeenCalled();
  });

  it('should reject duplicate discharge plan for same patient', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.dischargePlan.findUnique.mockResolvedValue(mockDischargePlan); // existing plan

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        estimatedDate: '2024-02-01T00:00:00.000Z',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(409); // Conflict - duplicate
  });

  it('should require clinical staff role', async () => {
    auth.mockResolvedValue(createMockSession('administrative')); // wrong role

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        estimatedDate: '2024-02-01T00:00:00.000Z',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should reject invalid patient ID', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(null);

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 999,
        estimatedDate: '2024-02-01T00:00:00.000Z',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});

// ============================================================
// PUT /api/discharge Tests - Update Discharge Plan
// ============================================================

describe('PUT /api/discharge - Update Discharge Plan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update discharge plan successfully', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.dischargePlan.findUnique.mockResolvedValue(mockDischargePlan);
    prisma.dischargePlan.update.mockResolvedValue({
      ...mockDischargePlan,
      status: 'READY',
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        dischargePlanId: 1,
        status: 'ready',
      },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(data.data.status).toBe('READY');
  });

  it('should set actualDate when status is discharged', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.dischargePlan.findUnique.mockResolvedValue(mockDischargePlan);
    prisma.dischargePlan.update.mockResolvedValue(mockDischargePlan);
    prisma.patient.update.mockResolvedValue(mockPatient);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        dischargePlanId: 1,
        status: 'discharged',
      },
    });

    await PUT(request);

    expect(prisma.dischargePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actualDate: expect.any(Date),
        }),
      })
    );
  });

  it('should update patient status when discharged', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.dischargePlan.findUnique.mockResolvedValue(mockDischargePlan);
    prisma.dischargePlan.update.mockResolvedValue({
      ...mockDischargePlan,
      status: 'DISCHARGED',
    });
    prisma.patient.update.mockResolvedValue(mockPatient);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        dischargePlanId: 1,
        status: 'discharged',
      },
    });

    await PUT(request);

    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockDischargePlan.patientId },
        data: expect.objectContaining({
          status: 'discharged',
        }),
      })
    );
  });

  it('should reject update without dischargePlanId', async () => {
    auth.mockResolvedValue(createMockSession('physician'));

    const request = createMockRequest({
      method: 'PUT',
      body: {
        status: 'ready',
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it('should reject update for non-existent discharge plan', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.dischargePlan.findUnique.mockResolvedValue(null);

    const request = createMockRequest({
      method: 'PUT',
      body: {
        dischargePlanId: 999,
        status: 'ready',
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(404);
  });
});

// ============================================================
// PUT /api/discharge Tests - Update Checklist Item
// ============================================================

describe('PUT /api/discharge - Update Checklist Item', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update checklist item successfully', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.dischargeChecklistItem.findUnique.mockResolvedValue({
      ...mockChecklistItem,
      dischargePlan: mockDischargePlan,
    });
    prisma.dischargeChecklistItem.update.mockResolvedValue({
      ...mockChecklistItem,
      status: 'COMPLETED',
    });
    prisma.dischargeChecklistItem.findMany.mockResolvedValue([
      { ...mockChecklistItem, status: 'COMPLETED', required: true },
      { ...mockChecklistItem, status: 'COMPLETED', required: true },
    ]);
    prisma.dischargePlan.update.mockResolvedValue(mockDischargePlan);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        itemId: 1,
        status: 'completed',
        notes: 'Item completed successfully',
      },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(data.data.status).toBe('COMPLETED');
  });

  it('should map lowercase checklist status to uppercase enum', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.dischargeChecklistItem.findUnique.mockResolvedValue({
      ...mockChecklistItem,
      dischargePlan: mockDischargePlan,
    });
    prisma.dischargeChecklistItem.update.mockResolvedValue(mockChecklistItem);
    prisma.dischargeChecklistItem.findMany.mockResolvedValue([mockChecklistItem]);
    prisma.dischargePlan.update.mockResolvedValue(mockDischargePlan);
    prisma.auditLog.create.mockResolvedValue({});

    const testCases = [
      { input: 'pending', expected: 'PENDING' },
      { input: 'in_progress', expected: 'IN_PROGRESS' },
      { input: 'completed', expected: 'COMPLETED' },
      { input: 'not_applicable', expected: 'NOT_APPLICABLE' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();

      const request = createMockRequest({
        method: 'PUT',
        body: {
          itemId: 1,
          status: testCase.input,
        },
      });

      await PUT(request);

      expect(prisma.dischargeChecklistItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: testCase.expected,
          }),
        })
      );
    }
  });

  it('should recalculate readiness score after item update', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.dischargeChecklistItem.findUnique.mockResolvedValue({
      ...mockChecklistItem,
      dischargePlan: mockDischargePlan,
    });
    prisma.dischargeChecklistItem.update.mockResolvedValue(mockChecklistItem);

    // 3 required items: 2 completed, 1 pending = 67% readiness
    prisma.dischargeChecklistItem.findMany.mockResolvedValue([
      { ...mockChecklistItem, id: 1, status: 'COMPLETED', required: true },
      { ...mockChecklistItem, id: 2, status: 'COMPLETED', required: true },
      { ...mockChecklistItem, id: 3, status: 'PENDING', required: true },
    ]);
    prisma.dischargePlan.update.mockResolvedValue(mockDischargePlan);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        itemId: 1,
        status: 'completed',
      },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(data.meta.readinessScore).toBe(67);
  });

  it('should update status to READY when all required items complete', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.dischargeChecklistItem.findUnique.mockResolvedValue({
      ...mockChecklistItem,
      dischargePlan: { ...mockDischargePlan, status: 'PLANNING' },
    });
    prisma.dischargeChecklistItem.update.mockResolvedValue(mockChecklistItem);

    // All required items completed
    prisma.dischargeChecklistItem.findMany.mockResolvedValue([
      { ...mockChecklistItem, id: 1, status: 'COMPLETED', required: true },
      { ...mockChecklistItem, id: 2, status: 'COMPLETED', required: true },
    ]);
    prisma.dischargePlan.update.mockResolvedValue(mockDischargePlan);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        itemId: 1,
        status: 'completed',
      },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(data.meta.allRequiredComplete).toBe(true);
    expect(prisma.dischargePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          readinessScore: 100,
          status: 'READY',
        }),
      })
    );
  });

  it('should set completedAt and completedById when item completed', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.dischargeChecklistItem.findUnique.mockResolvedValue({
      ...mockChecklistItem,
      dischargePlan: mockDischargePlan,
    });
    prisma.dischargeChecklistItem.update.mockResolvedValue(mockChecklistItem);
    prisma.dischargeChecklistItem.findMany.mockResolvedValue([mockChecklistItem]);
    prisma.dischargePlan.update.mockResolvedValue(mockDischargePlan);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        itemId: 1,
        status: 'completed',
      },
    });

    await PUT(request);

    expect(prisma.dischargeChecklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          completedById: 1,
        }),
      })
    );
  });

  it('should reject update for non-existent item', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.dischargeChecklistItem.findUnique.mockResolvedValue(null);

    const request = createMockRequest({
      method: 'PUT',
      body: {
        itemId: 999,
        status: 'completed',
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(404);
  });
});

// ============================================================
// Edge Cases and Clinical Validation Tests
// ============================================================

describe('Discharge API - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle discharge plan with no checklist items', async () => {
    const emptyPlan = {
      ...mockDischargePlan,
      checklistItems: [],
    };

    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([emptyPlan]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data[0].checklistStats.total).toBe(0);
    expect(data.data[0].checklistStats.readinessScore).toBe(0);
  });

  it('should handle readiness score with only non-required items', async () => {
    const planWithOptionalItems = {
      ...mockDischargePlan,
      checklistItems: [
        { ...mockChecklistItem, id: 1, status: 'PENDING', required: false },
        { ...mockChecklistItem, id: 2, status: 'COMPLETED', required: false },
      ],
    };

    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([planWithOptionalItems]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    // No required items, so readiness should be 0
    expect(data.data[0].checklistStats.readinessScore).toBe(0);
  });

  it('should handle multiple discharge plans (should only have one)', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([mockDischargePlan, mockDischargePlan]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    // Should return all plans (even though there should only be one)
    expect(data.data).toHaveLength(2);
  });

  it('should handle null optional fields in discharge plan', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.dischargePlan.findUnique.mockResolvedValue(null);

    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback({
        dischargePlan: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
          findUnique: jest.fn().mockResolvedValue({
            ...mockDischargePlan,
            primaryCaregiver: null,
            caregiverPhone: null,
            specialInstructions: null,
            followUpPlan: null,
          }),
        },
        dischargeChecklistItem: {
          createMany: jest.fn().mockResolvedValue({ count: 10 }),
        },
      });
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        estimatedDate: '2024-02-01T00:00:00.000Z',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('should validate disposition enum values', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.dischargePlan.findUnique.mockResolvedValue(null);

    const validDispositions = ['home', 'transfer', 'hospice', 'deceased'];

    for (const disposition of validDispositions) {
      jest.clearAllMocks();

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          dischargePlan: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
            findUnique: jest.fn().mockResolvedValue(mockDischargePlan),
          },
          dischargeChecklistItem: {
            createMany: jest.fn().mockResolvedValue({ count: 10 }),
          },
        });
      });
      prisma.auditLog.create.mockResolvedValue({});

      const request = createMockRequest({
        method: 'POST',
        body: {
          patientId: 1,
          estimatedDate: '2024-02-01T00:00:00.000Z',
          disposition,
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    }
  });

  it('should handle checklist categories correctly', async () => {
    const categories = [
      'MEDICAL_STABILITY',
      'FEEDING_NUTRITION',
      'EQUIPMENT_DME',
      'CAR_SEAT_SAFETY',
      'FAMILY_EDUCATION',
      'FOLLOW_UP',
      'DOCUMENTATION',
      'SOCIAL_SERVICES',
    ];

    const planWithAllCategories = {
      ...mockDischargePlan,
      checklistItems: categories.map((cat, idx) => ({
        ...mockChecklistItem,
        id: idx + 1,
        category: cat,
        status: idx % 2 === 0 ? 'COMPLETED' : 'PENDING',
      })),
    };

    auth.mockResolvedValue(createMockSession());
    prisma.dischargePlan.findMany.mockResolvedValue([planWithAllCategories]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/discharge?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(Object.keys(data.data[0].checklistStats.byCategory)).toHaveLength(categories.length);
  });
});
