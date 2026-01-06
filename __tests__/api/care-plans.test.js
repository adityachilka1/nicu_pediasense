/**
 * Care Plans API Route Tests
 * Tests for /api/care-plans routes including GET, POST, and PUT operations
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
    carePlan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    carePlanItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
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

import { GET, POST, PUT } from '@/app/api/care-plans/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// ============================================================
// Test Utilities
// ============================================================

function createMockRequest(options = {}) {
  const url = new URL(options.url || 'http://localhost:3000/api/care-plans');

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

const mockCarePlan = {
  id: 1,
  patientId: 1,
  createdById: 1,
  title: 'Respiratory Support Plan',
  category: 'RESPIRATORY',
  description: 'Plan for weaning from oxygen',
  goals: JSON.stringify(['Wean to room air', 'Maintain SpO2 >90%']),
  priority: 'HIGH',
  status: 'ACTIVE',
  targetDate: new Date('2024-02-01T00:00:00.000Z'),
  completedAt: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  patient: {
    id: 1,
    mrn: 'MRN001',
    name: 'Baby Smith',
  },
  createdBy: {
    id: 1,
    fullName: 'Dr. Jane Doe',
    initials: 'JD',
    role: 'physician',
  },
  items: [],
  _count: { items: 0 },
};

const mockCarePlanItem = {
  id: 1,
  carePlanId: 1,
  description: 'Decrease FiO2 by 5% daily',
  itemType: 'TASK',
  frequency: 'daily',
  status: 'PENDING',
  dueDate: new Date('2024-01-05T00:00:00.000Z'),
  completedAt: null,
  completedById: null,
  notes: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const mockPatient = {
  id: 1,
  mrn: 'MRN001',
  name: 'Baby Smith',
  status: 'normal',
};

// ============================================================
// GET /api/care-plans Tests
// ============================================================

describe('GET /api/care-plans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch care plans for a patient successfully', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.carePlan.findMany.mockResolvedValue([mockCarePlan]);
    prisma.carePlanItem.groupBy.mockResolvedValue([]);
    prisma.carePlan.groupBy.mockResolvedValue([
      { category: 'RESPIRATORY', _count: 1 },
    ]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/care-plans?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(1);
    expect(data.data[0].category).toBe('RESPIRATORY');
    expect(data.data[0].goals).toEqual(['Wean to room air', 'Maintain SpO2 >90%']);
  });

  it('should filter by status with lowercase to uppercase mapping', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.carePlan.findMany.mockResolvedValue([mockCarePlan]);
    prisma.carePlanItem.groupBy.mockResolvedValue([]);
    prisma.carePlan.groupBy.mockResolvedValue([]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/care-plans?patientId=1&status=active',
    });

    await GET(request);

    expect(prisma.carePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE', // lowercase should map to uppercase
        }),
      })
    );
  });

  it('should filter by category with lowercase to uppercase mapping', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.carePlan.findMany.mockResolvedValue([mockCarePlan]);
    prisma.carePlanItem.groupBy.mockResolvedValue([]);
    prisma.carePlan.groupBy.mockResolvedValue([]);

    const testCases = [
      { input: 'respiratory', expected: 'RESPIRATORY' },
      { input: 'nutrition', expected: 'NUTRITION' },
      { input: 'neuro', expected: 'NEUROLOGICAL' },
      { input: 'growth', expected: 'GROWTH_DEVELOPMENT' },
      { input: 'skin', expected: 'SKIN_WOUND' },
      { input: 'family', expected: 'FAMILY_SUPPORT' },
      { input: 'pain', expected: 'PAIN_MANAGEMENT' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();

      const request = createMockRequest({
        url: `http://localhost:3000/api/care-plans?patientId=1&category=${testCase.input}`,
      });

      await GET(request);

      expect(prisma.carePlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: testCase.expected,
          }),
        })
      );
    }
  });

  it('should include items when includeItems is not false', async () => {
    auth.mockResolvedValue(createMockSession());
    const planWithItems = {
      ...mockCarePlan,
      items: [mockCarePlanItem],
    };
    prisma.carePlan.findMany.mockResolvedValue([planWithItems]);
    prisma.carePlanItem.groupBy.mockResolvedValue([
      { carePlanId: 1, status: 'PENDING', _count: 1 },
    ]);
    prisma.carePlan.groupBy.mockResolvedValue([]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/care-plans?patientId=1&includeItems=true',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data[0].items).toBeDefined();
    expect(data.data[0].itemStats).toBeDefined();
  });

  it('should exclude items when includeItems is false', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.carePlan.findMany.mockResolvedValue([mockCarePlan]);
    prisma.carePlan.groupBy.mockResolvedValue([]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/care-plans?patientId=1&includeItems=false',
    });

    await GET(request);

    expect(prisma.carePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          items: false,
        }),
      })
    );
  });

  it('should calculate item statistics', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.carePlan.findMany.mockResolvedValue([mockCarePlan]);
    prisma.carePlanItem.groupBy.mockResolvedValue([
      { carePlanId: 1, status: 'PENDING', _count: 2 },
      { carePlanId: 1, status: 'IN_PROGRESS', _count: 1 },
      { carePlanId: 1, status: 'COMPLETED', _count: 3 },
    ]);
    prisma.carePlan.groupBy.mockResolvedValue([]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/care-plans?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data[0].itemStats.total).toBe(6);
    expect(data.data[0].itemStats.pending).toBe(2);
    expect(data.data[0].itemStats.inProgress).toBe(1);
    expect(data.data[0].itemStats.completed).toBe(3);
  });
});

// ============================================================
// POST /api/care-plans Tests
// ============================================================

describe('POST /api/care-plans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new care plan successfully', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.$transaction.mockImplementation(async (callback) => {
      const result = await callback({
        carePlan: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
          findUnique: jest.fn().mockResolvedValue(mockCarePlan),
        },
        carePlanItem: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      });
      return result;
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        title: 'Respiratory Support Plan',
        category: 'respiratory',
        description: 'Plan for weaning from oxygen',
        goals: ['Wean to room air', 'Maintain SpO2 >90%'],
        priority: 'high',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.id).toBe(1);
  });

  it('should map lowercase category to uppercase enum', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);

    const createMock = jest.fn().mockResolvedValue({ id: 1 });
    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback({
        carePlan: {
          create: createMock,
          findUnique: jest.fn().mockResolvedValue(mockCarePlan),
        },
        carePlanItem: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      });
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        title: 'Test Plan',
        category: 'nutrition', // lowercase
        priority: 'medium',
      },
    });

    await POST(request);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'NUTRITION', // should be uppercase
        }),
      })
    );
  });

  it('should map lowercase priority to uppercase enum', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);

    const createMock = jest.fn().mockResolvedValue({ id: 1 });
    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback({
        carePlan: {
          create: createMock,
          findUnique: jest.fn().mockResolvedValue(mockCarePlan),
        },
        carePlanItem: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      });
    });
    prisma.auditLog.create.mockResolvedValue({});

    const testCases = [
      { input: 'high', expected: 'HIGH' },
      { input: 'medium', expected: 'MEDIUM' },
      { input: 'low', expected: 'LOW' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();

      const request = createMockRequest({
        method: 'POST',
        body: {
          patientId: 1,
          title: 'Test Plan',
          category: 'nutrition',
          priority: testCase.input,
        },
      });

      await POST(request);

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: testCase.expected,
          }),
        })
      );
    }
  });

  it('should create care plan with items', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);

    const createManyMock = jest.fn().mockResolvedValue({ count: 2 });
    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback({
        carePlan: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
          findUnique: jest.fn().mockResolvedValue(mockCarePlan),
        },
        carePlanItem: {
          createMany: createManyMock,
        },
      });
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        title: 'Test Plan',
        category: 'respiratory',
        priority: 'high',
        items: [
          {
            description: 'Task 1',
            itemType: 'task',
            frequency: 'daily',
          },
          {
            description: 'Task 2',
            itemType: 'assessment',
            frequency: 'weekly',
          },
        ],
      },
    });

    await POST(request);

    expect(createManyMock).toHaveBeenCalled();
  });

  it('should require clinical staff role', async () => {
    auth.mockResolvedValue(createMockSession('administrative')); // wrong role

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        title: 'Test Plan',
        category: 'respiratory',
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
        title: 'Test Plan',
        category: 'respiratory',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('should require title field', async () => {
    auth.mockResolvedValue(createMockSession('physician'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'respiratory',
        // missing title
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

// ============================================================
// PUT /api/care-plans Tests
// ============================================================

describe('PUT /api/care-plans - Update Care Plan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update care plan successfully', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.carePlan.findUnique.mockResolvedValue(mockCarePlan);
    prisma.carePlan.update.mockResolvedValue({
      ...mockCarePlan,
      title: 'Updated Title',
      status: 'COMPLETED',
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        carePlanId: 1,
        title: 'Updated Title',
        status: 'completed',
      },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(data.data.title).toBe('Updated Title');
    expect(data.data.status).toBe('COMPLETED');
  });

  it('should map lowercase status to uppercase enum', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.carePlan.findUnique.mockResolvedValue(mockCarePlan);
    prisma.carePlan.update.mockResolvedValue(mockCarePlan);
    prisma.auditLog.create.mockResolvedValue({});

    const testCases = [
      { input: 'active', expected: 'ACTIVE' },
      { input: 'on_hold', expected: 'ON_HOLD' },
      { input: 'completed', expected: 'COMPLETED' },
      { input: 'discontinued', expected: 'DISCONTINUED' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();

      const request = createMockRequest({
        method: 'PUT',
        body: {
          carePlanId: 1,
          status: testCase.input,
        },
      });

      await PUT(request);

      expect(prisma.carePlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: testCase.expected,
          }),
        })
      );
    }
  });

  it('should set completedAt when status is completed', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.carePlan.findUnique.mockResolvedValue(mockCarePlan);
    prisma.carePlan.update.mockResolvedValue(mockCarePlan);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        carePlanId: 1,
        status: 'completed',
      },
    });

    await PUT(request);

    expect(prisma.carePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it('should reject update without carePlanId', async () => {
    auth.mockResolvedValue(createMockSession('physician'));

    const request = createMockRequest({
      method: 'PUT',
      body: {
        title: 'Updated Title',
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it('should reject update for non-existent care plan', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.carePlan.findUnique.mockResolvedValue(null);

    const request = createMockRequest({
      method: 'PUT',
      body: {
        carePlanId: 999,
        title: 'Updated Title',
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(404);
  });
});

// ============================================================
// PUT /api/care-plans Tests - Update Care Plan Item
// ============================================================

describe('PUT /api/care-plans - Update Care Plan Item', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update care plan item successfully', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.carePlanItem.findUnique.mockResolvedValue({
      ...mockCarePlanItem,
      carePlan: mockCarePlan,
    });
    prisma.carePlanItem.update.mockResolvedValue({
      ...mockCarePlanItem,
      status: 'COMPLETED',
    });
    prisma.carePlanItem.count.mockResolvedValueOnce(3); // total items
    prisma.carePlanItem.count.mockResolvedValueOnce(0); // incomplete items
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        itemId: 1,
        status: 'completed',
        notes: 'Task completed successfully',
      },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(data.data.status).toBe('COMPLETED');
  });

  it('should map lowercase item status to uppercase enum', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.carePlanItem.findUnique.mockResolvedValue({
      ...mockCarePlanItem,
      carePlan: mockCarePlan,
    });
    prisma.carePlanItem.update.mockResolvedValue(mockCarePlanItem);
    prisma.carePlanItem.count.mockResolvedValue(1);
    prisma.auditLog.create.mockResolvedValue({});

    const testCases = [
      { input: 'pending', expected: 'PENDING' },
      { input: 'in_progress', expected: 'IN_PROGRESS' },
      { input: 'completed', expected: 'COMPLETED' },
      { input: 'skipped', expected: 'SKIPPED' },
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

      expect(prisma.carePlanItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: testCase.expected,
          }),
        })
      );
    }
  });

  it('should auto-complete care plan when all items are completed', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.carePlanItem.findUnique.mockResolvedValue({
      ...mockCarePlanItem,
      carePlan: mockCarePlan,
    });
    prisma.carePlanItem.update.mockResolvedValue(mockCarePlanItem);
    prisma.carePlanItem.count.mockResolvedValueOnce(3); // total items
    prisma.carePlanItem.count.mockResolvedValueOnce(0); // no incomplete items
    prisma.carePlan.update.mockResolvedValue(mockCarePlan);
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

    expect(data.meta.carePlanCompleted).toBe(true);
    expect(prisma.carePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
        }),
      })
    );
  });

  it('should not auto-complete care plan when items remain', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.carePlanItem.findUnique.mockResolvedValue({
      ...mockCarePlanItem,
      carePlan: mockCarePlan,
    });
    prisma.carePlanItem.update.mockResolvedValue(mockCarePlanItem);
    prisma.carePlanItem.count.mockResolvedValueOnce(3); // total items
    prisma.carePlanItem.count.mockResolvedValueOnce(1); // 1 incomplete item
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

    expect(data.meta.carePlanCompleted).toBe(false);
  });

  it('should set completedAt and completedById when item completed', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.carePlanItem.findUnique.mockResolvedValue({
      ...mockCarePlanItem,
      carePlan: mockCarePlan,
    });
    prisma.carePlanItem.update.mockResolvedValue(mockCarePlanItem);
    prisma.carePlanItem.count.mockResolvedValue(1);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        itemId: 1,
        status: 'completed',
      },
    });

    await PUT(request);

    expect(prisma.carePlanItem.update).toHaveBeenCalledWith(
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
    prisma.carePlanItem.findUnique.mockResolvedValue(null);

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

describe('Care Plans API - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle care plan with empty goals array', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);

    const createMock = jest.fn().mockResolvedValue({ id: 1 });
    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback({
        carePlan: {
          create: createMock,
          findUnique: jest.fn().mockResolvedValue({
            ...mockCarePlan,
            goals: JSON.stringify([]),
          }),
        },
        carePlanItem: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      });
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        title: 'Test Plan',
        category: 'respiratory',
        goals: [],
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('should handle care plan with null description', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);

    const createMock = jest.fn().mockResolvedValue({ id: 1 });
    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback({
        carePlan: {
          create: createMock,
          findUnique: jest.fn().mockResolvedValue({
            ...mockCarePlan,
            description: null,
          }),
        },
        carePlanItem: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      });
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        title: 'Test Plan',
        category: 'respiratory',
        description: null,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('should handle multiple category mappings', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.carePlan.findMany.mockResolvedValue([]);
    prisma.carePlan.groupBy.mockResolvedValue([]);

    // Test alternative category names
    const alternatives = [
      { input: 'neuro', expected: 'NEUROLOGICAL' },
      { input: 'neurological', expected: 'NEUROLOGICAL' },
      { input: 'growth', expected: 'GROWTH_DEVELOPMENT' },
      { input: 'growth_development', expected: 'GROWTH_DEVELOPMENT' },
    ];

    for (const alt of alternatives) {
      jest.clearAllMocks();

      const request = createMockRequest({
        url: `http://localhost:3000/api/care-plans?category=${alt.input}`,
      });

      await GET(request);

      expect(prisma.carePlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: alt.expected,
          }),
        })
      );
    }
  });
});
