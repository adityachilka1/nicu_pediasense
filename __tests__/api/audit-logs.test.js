/**
 * Audit Logs API Route Tests
 * Tests for GET /api/audit-logs (HIPAA compliance logging)
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
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
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
    elapsed: jest.fn(() => 50),
  })),
}));

import { GET } from '@/app/api/audit-logs/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// ============================================================
// Test Utilities
// ============================================================

function createMockRequest(options = {}) {
  const url = new URL(options.url || 'http://localhost:3000/api/audit-logs');

  return {
    url: url.toString(),
    method: 'GET',
    headers: {
      get: jest.fn((header) => {
        const headers = {
          'x-forwarded-for': '127.0.0.1',
          ...options.headers,
        };
        return headers[header.toLowerCase()] || null;
      }),
    },
  };
}

function createMockSession(role = 'admin', userId = 1) {
  return {
    user: {
      id: userId.toString(),
      email: `${role}@hospital.org`,
      role: role,
      fullName: 'Test Admin',
    },
  };
}

// Mock audit log data
const mockAuditLog = {
  id: 1,
  userId: 1,
  action: 'view_patient',
  resource: 'patient',
  resourceId: 123,
  details: JSON.stringify({ patientName: 'Baby Doe' }),
  ipAddress: '192.168.1.100',
  createdAt: new Date('2025-01-20T10:30:00Z'),
  user: {
    id: 1,
    email: 'nurse@hospital.org',
    fullName: 'Nurse Moore',
    role: 'staff_nurse',
  },
};

// ============================================================
// Authentication & Authorization Tests
// ============================================================

describe('GET /api/audit-logs - Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
    prisma.auditLog.count.mockResolvedValue(1);
  });

  test('returns 401 for unauthenticated requests', async () => {
    auth.mockResolvedValue(null);
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('AUTHENTICATION_ERROR');
  });

  test('returns 403 for staff_nurse (non-admin)', async () => {
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('AUTHORIZATION_ERROR');
  });

  test('returns 403 for charge_nurse (non-admin)', async () => {
    auth.mockResolvedValue(createMockSession('charge_nurse'));
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
  });

  test('returns 403 for physician (non-admin)', async () => {
    auth.mockResolvedValue(createMockSession('physician'));
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
  });

  test('allows admin to view audit logs', async () => {
    auth.mockResolvedValue(createMockSession('admin'));
    const request = createMockRequest();

    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});

// ============================================================
// Response Format Tests
// ============================================================

describe('GET /api/audit-logs - Response Format', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('admin'));
    prisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
    prisma.auditLog.count.mockResolvedValue(1);
  });

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

  test('transforms audit log data correctly', async () => {
    const request = createMockRequest();
    const response = await GET(request);
    const { data } = await response.json();

    expect(data[0]).toMatchObject({
      id: 1,
      userId: 1,
      action: 'view_patient',
      resource: 'patient',
      resourceId: 123,
    });
  });

  test('includes user details', async () => {
    const request = createMockRequest();
    const response = await GET(request);
    const { data } = await response.json();

    expect(data[0].user).toMatchObject({
      id: 1,
      email: 'nurse@hospital.org',
      fullName: 'Nurse Moore',
      role: 'staff_nurse',
    });
  });

  test('parses JSON details', async () => {
    const request = createMockRequest();
    const response = await GET(request);
    const { data } = await response.json();

    expect(data[0].details).toEqual({ patientName: 'Baby Doe' });
  });

  test('handles null details', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ ...mockAuditLog, details: null }]);
    const request = createMockRequest();
    const response = await GET(request);
    const { data } = await response.json();

    expect(data[0].details).toBeNull();
  });

  test('formats createdAt as ISO string', async () => {
    const request = createMockRequest();
    const response = await GET(request);
    const { data } = await response.json();

    expect(data[0].createdAt).toBe('2025-01-20T10:30:00.000Z');
  });
});

// ============================================================
// Filtering Tests
// ============================================================

describe('GET /api/audit-logs - Filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('admin'));
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);
  });

  test('filters by userId', async () => {
    const request = createMockRequest({ url: 'http://localhost:3000/api/audit-logs?userId=5' });
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 5 }),
      })
    );
  });

  test('filters by action (partial match)', async () => {
    const request = createMockRequest({ url: 'http://localhost:3000/api/audit-logs?action=view' });
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { contains: 'view' },
        }),
      })
    );
  });

  test('filters by resource', async () => {
    const request = createMockRequest({ url: 'http://localhost:3000/api/audit-logs?resource=patient' });
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resource: 'patient' }),
      })
    );
  });

  test('filters by date range (dateFrom)', async () => {
    const dateFrom = '2025-01-01T00:00:00Z';
    const request = createMockRequest({ url: `http://localhost:3000/api/audit-logs?dateFrom=${dateFrom}` });
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      })
    );
  });

  test('filters by date range (dateTo)', async () => {
    const dateTo = '2025-01-31T23:59:59Z';
    const request = createMockRequest({ url: `http://localhost:3000/api/audit-logs?dateTo=${dateTo}` });
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  test('combines multiple filters', async () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/audit-logs?userId=1&action=update&resource=patient',
    });
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 1,
          action: { contains: 'update' },
          resource: 'patient',
        }),
      })
    );
  });
});

// ============================================================
// Validation Tests
// ============================================================

describe('GET /api/audit-logs - Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('admin'));
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);
  });

  test('rejects non-numeric userId', async () => {
    const request = createMockRequest({ url: 'http://localhost:3000/api/audit-logs?userId=abc' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects invalid dateFrom format', async () => {
    const request = createMockRequest({ url: 'http://localhost:3000/api/audit-logs?dateFrom=not-a-date' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
  });

  test('rejects invalid dateTo format', async () => {
    const request = createMockRequest({ url: 'http://localhost:3000/api/audit-logs?dateTo=invalid' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
  });
});

// ============================================================
// Pagination Tests
// ============================================================

describe('GET /api/audit-logs - Pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('admin'));
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);
  });

  test('uses default pagination (page 1, limit 50)', async () => {
    const request = createMockRequest();
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
      })
    );
  });

  test('accepts custom page and limit', async () => {
    const request = createMockRequest({ url: 'http://localhost:3000/api/audit-logs?page=3&limit=25' });
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50, // (page 3 - 1) * 25
        take: 25,
      })
    );
  });

  test('enforces max limit of 100', async () => {
    const request = createMockRequest({ url: 'http://localhost:3000/api/audit-logs?limit=500' });
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    );
  });
});

// ============================================================
// Ordering Tests
// ============================================================

describe('GET /api/audit-logs - Ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('admin'));
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);
  });

  test('orders by createdAt descending (newest first)', async () => {
    const request = createMockRequest();
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});

// ============================================================
// HIPAA Compliance Tests
// ============================================================

describe('GET /api/audit-logs - HIPAA Compliance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('admin'));
    prisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
    prisma.auditLog.count.mockResolvedValue(1);
  });

  test('includes user information for each log', async () => {
    const request = createMockRequest();
    await GET(request);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          user: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              email: true,
              fullName: true,
              role: true,
            }),
          }),
        }),
      })
    );
  });

  test('includes IP address in response', async () => {
    const request = createMockRequest();
    const response = await GET(request);
    const { data } = await response.json();

    expect(data[0]).toHaveProperty('ipAddress');
  });

  test('includes timestamp in response', async () => {
    const request = createMockRequest();
    const response = await GET(request);
    const { data } = await response.json();

    expect(data[0]).toHaveProperty('createdAt');
  });

  test('includes resource identification', async () => {
    const request = createMockRequest();
    const response = await GET(request);
    const { data } = await response.json();

    expect(data[0]).toHaveProperty('resource');
    expect(data[0]).toHaveProperty('resourceId');
  });
});

// ============================================================
// Security Tests
// ============================================================

describe('GET /api/audit-logs - Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);
  });

  test('only admin can access (principle of least privilege)', async () => {
    const roles = ['staff_nurse', 'charge_nurse', 'physician', 'administrative'];

    for (const role of roles) {
      auth.mockResolvedValue(createMockSession(role));
      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(403);
    }
  });

  test('admin access is granted', async () => {
    auth.mockResolvedValue(createMockSession('admin'));
    const request = createMockRequest();
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
