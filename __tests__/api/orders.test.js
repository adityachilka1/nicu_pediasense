/**
 * Orders API Route Tests
 * Tests for /api/orders routes including GET, POST, and PUT operations
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
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    orderSet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
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

import { GET, POST, PUT } from '@/app/api/orders/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// ============================================================
// Test Utilities
// ============================================================

function createMockRequest(options = {}) {
  const url = new URL(options.url || 'http://localhost:3000/api/orders');

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

function createMockSession(role = 'physician') {
  return {
    user: {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role,
    },
  };
}

const mockOrder = {
  id: 1,
  patientId: 1,
  orderingId: 1,
  category: 'MEDICATION',
  orderType: 'RECURRING',
  priority: 'ROUTINE',
  name: 'Ampicillin 50mg IV q12h',
  details: JSON.stringify({ dose: '50mg', route: 'IV', frequency: 'q12h' }),
  instructions: 'Administer over 30 minutes',
  status: 'ACTIVE',
  orderSetId: null,
  startTime: new Date('2024-01-01T00:00:00.000Z'),
  endTime: null,
  discontinuedAt: null,
  discontinuedById: null,
  discontinueReason: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  patient: {
    id: 1,
    mrn: 'MRN001',
    name: 'Baby Smith',
  },
  ordering: {
    id: 1,
    fullName: 'Dr. Jane Doe',
    initials: 'JD',
    role: 'physician',
  },
  discontinuedBy: null,
  orderSet: null,
};

const mockPatient = {
  id: 1,
  mrn: 'MRN001',
  name: 'Baby Smith',
  dateOfBirth: new Date('2024-01-01'),
  gender: 'M',
  status: 'normal',
};

// ============================================================
// GET /api/orders Tests
// ============================================================

describe('GET /api/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch orders for a patient successfully', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.order.findMany.mockResolvedValue([mockOrder]);
    prisma.order.count.mockResolvedValue(1);
    prisma.order.groupBy.mockResolvedValue([
      { category: 'MEDICATION', _count: 1 },
    ]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/orders?patientId=1',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(1);
    expect(data.data[0].category).toBe('MEDICATION');
    expect(data.data[0].details).toEqual({ dose: '50mg', route: 'IV', frequency: 'q12h' });
    expect(data.meta.total).toBe(1);
    expect(data.meta.categorySummary).toEqual({ MEDICATION: 1 });
  });

  it('should filter orders by status (lowercase to uppercase mapping)', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.order.findMany.mockResolvedValue([mockOrder]);
    prisma.order.count.mockResolvedValue(1);
    prisma.order.groupBy.mockResolvedValue([]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/orders?patientId=1&status=active',
    });

    await GET(request);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: 1,
          status: 'ACTIVE', // lowercase 'active' should be mapped to 'ACTIVE'
        }),
      })
    );
  });

  it('should filter orders by category (lowercase to uppercase mapping)', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.order.findMany.mockResolvedValue([mockOrder]);
    prisma.order.count.mockResolvedValue(1);
    prisma.order.groupBy.mockResolvedValue([]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/orders?patientId=1&category=medication',
    });

    await GET(request);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: 1,
          category: 'MEDICATION', // lowercase 'medication' should be mapped to 'MEDICATION'
        }),
      })
    );
  });

  it('should include order sets when requested', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.order.findMany.mockResolvedValue([mockOrder]);
    prisma.order.count.mockResolvedValue(1);
    prisma.order.groupBy.mockResolvedValue([]);
    prisma.orderSet.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Sepsis Bundle',
        category: 'MEDICATION',
        active: true,
        items: JSON.stringify([{ name: 'Ampicillin' }, { name: 'Gentamicin' }]),
      },
    ]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/orders?patientId=1&includeOrderSets=true',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.meta.orderSets).toBeDefined();
    expect(data.meta.orderSets).toHaveLength(1);
    expect(data.meta.orderSets[0].items).toEqual([{ name: 'Ampicillin' }, { name: 'Gentamicin' }]);
  });

  it('should respect pagination parameters', async () => {
    auth.mockResolvedValue(createMockSession());
    prisma.order.findMany.mockResolvedValue([mockOrder]);
    prisma.order.count.mockResolvedValue(50);
    prisma.order.groupBy.mockResolvedValue([]);

    const request = createMockRequest({
      url: 'http://localhost:3000/api/orders?patientId=1&limit=10&offset=20',
    });

    await GET(request);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    );
  });

  it('should require authentication', async () => {
    auth.mockResolvedValue(null);

    const request = createMockRequest();

    const response = await GET(request);
    expect(response.status).toBe(401);
  });
});

// ============================================================
// POST /api/orders Tests
// ============================================================

describe('POST /api/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new order successfully', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.order.create.mockResolvedValue(mockOrder);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'medication',
        orderType: 'recurring',
        priority: 'routine',
        name: 'Ampicillin 50mg IV q12h',
        details: { dose: '50mg', route: 'IV', frequency: 'q12h' },
        instructions: 'Administer over 30 minutes',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.id).toBe(1);
    expect(data.data.category).toBe('MEDICATION');
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 1,
          category: 'MEDICATION', // lowercase should map to uppercase
          orderType: 'RECURRING',
          priority: 'ROUTINE',
          status: 'PENDING',
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('should map lowercase enum values to uppercase for category', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.order.create.mockResolvedValue(mockOrder);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'lab', // lowercase
        orderType: 'one_time',
        name: 'CBC with differential',
      },
    });

    await POST(request);

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'LAB', // should be uppercase
        }),
      })
    );
  });

  it('should map lowercase enum values to uppercase for orderType', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.order.create.mockResolvedValue(mockOrder);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'medication',
        orderType: 'prn', // lowercase
        name: 'Acetaminophen PRN',
      },
    });

    await POST(request);

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderType: 'PRN', // should be uppercase
        }),
      })
    );
  });

  it('should map lowercase enum values to uppercase for priority', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.order.create.mockResolvedValue(mockOrder);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'lab',
        orderType: 'one_time',
        priority: 'stat', // lowercase
        name: 'Blood culture STAT',
      },
    });

    await POST(request);

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: 'STAT', // should be uppercase
        }),
      })
    );
  });

  it('should reject order creation with invalid patient ID', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(null);

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 999,
        category: 'medication',
        orderType: 'recurring',
        name: 'Test Order',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('should reject order creation with missing required fields', async () => {
    auth.mockResolvedValue(createMockSession('physician'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        // missing category and orderType
        name: 'Test Order',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should require physician or charge nurse role', async () => {
    auth.mockResolvedValue(createMockSession('administrative')); // wrong role

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'medication',
        orderType: 'recurring',
        name: 'Test Order',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should verify order set exists when orderSetId is provided', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.orderSet.findUnique.mockResolvedValue(null); // order set not found

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'medication',
        orderType: 'recurring',
        name: 'Test Order',
        orderSetId: 999,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

// ============================================================
// PUT /api/orders Tests
// ============================================================

describe('PUT /api/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update order status successfully', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.order.findUnique.mockResolvedValue(mockOrder);
    prisma.order.update.mockResolvedValue({
      ...mockOrder,
      status: 'COMPLETED',
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        orderId: 1,
        status: 'completed', // lowercase
      },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(data.data.status).toBe('COMPLETED');
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'COMPLETED', // lowercase should map to uppercase
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('should discontinue order with reason', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.order.findUnique.mockResolvedValue(mockOrder);
    prisma.order.update.mockResolvedValue({
      ...mockOrder,
      status: 'DISCONTINUED',
      discontinuedAt: new Date(),
      discontinuedById: 1,
      discontinueReason: 'No longer needed',
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        orderId: 1,
        status: 'discontinued',
        discontinueReason: 'No longer needed',
      },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(data.data.status).toBe('DISCONTINUED');
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DISCONTINUED',
          discontinuedAt: expect.any(Date),
          discontinuedById: 1,
          discontinueReason: 'No longer needed',
        }),
      })
    );
  });

  it('should reject update with invalid status', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.order.findUnique.mockResolvedValue(mockOrder);

    const request = createMockRequest({
      method: 'PUT',
      body: {
        orderId: 1,
        status: 'invalid_status',
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it('should reject update with missing orderId', async () => {
    auth.mockResolvedValue(createMockSession('physician'));

    const request = createMockRequest({
      method: 'PUT',
      body: {
        status: 'completed',
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it('should reject update for non-existent order', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.order.findUnique.mockResolvedValue(null);

    const request = createMockRequest({
      method: 'PUT',
      body: {
        orderId: 999,
        status: 'completed',
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(404);
  });

  it('should allow staff nurse to update order status', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse')); // staff nurse
    prisma.order.findUnique.mockResolvedValue(mockOrder);
    prisma.order.update.mockResolvedValue({
      ...mockOrder,
      status: 'COMPLETED',
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'PUT',
      body: {
        orderId: 1,
        status: 'completed',
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);
  });
});

// ============================================================
// Edge Cases and Validation Tests
// ============================================================

describe('Orders API - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle orders with null/optional fields', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.order.create.mockResolvedValue({
      ...mockOrder,
      details: null,
      instructions: null,
      orderSetId: null,
      startTime: null,
      endTime: null,
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'medication',
        orderType: 'one_time',
        name: 'Test Order',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.data.details).toBeNull();
    expect(data.data.instructions).toBeNull();
  });

  it('should handle lowercase enum values correctly', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.order.create.mockResolvedValue(mockOrder);
    prisma.auditLog.create.mockResolvedValue({});

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'medication', // lowercase expected by validation
        orderType: 'recurring',
        priority: 'stat',
        name: 'Test Order',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('should reject uppercase enum values (validation requires lowercase)', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 1,
        category: 'MEDICATION', // uppercase - should fail validation
        orderType: 'RECURRING',
        name: 'Test Order',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400); // Validation error
  });

  it('should reject invalid patientId format', async () => {
    auth.mockResolvedValue(createMockSession('physician'));

    const request = createMockRequest({
      method: 'POST',
      body: {
        patientId: 'invalid', // string instead of number
        category: 'medication',
        orderType: 'recurring',
        name: 'Test Order',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle concurrent order updates gracefully', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    prisma.order.findUnique.mockResolvedValue(mockOrder);
    prisma.order.update.mockResolvedValue({
      ...mockOrder,
      status: 'COMPLETED',
    });
    prisma.auditLog.create.mockResolvedValue({});

    const request1 = createMockRequest({
      method: 'PUT',
      body: { orderId: 1, status: 'completed' },
    });

    const request2 = createMockRequest({
      method: 'PUT',
      body: { orderId: 1, status: 'cancelled' },
    });

    // Both should succeed (last one wins in the DB)
    await expect(PUT(request1)).resolves.toBeDefined();
    await expect(PUT(request2)).resolves.toBeDefined();
  });
});
