/**
 * Patients [ID] API Route Tests
 * Tests for GET /api/patients/[id], PATCH /api/patients/[id], DELETE /api/patients/[id]
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
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    bed: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    alarm: {
      updateMany: jest.fn(),
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

import { GET, PATCH, DELETE } from '@/app/api/patients/[id]/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import {
  createMockSession,
  createMockRequestWithParams,
  createMockPatient,
  createMockBed,
  createMockVital,
  createMockAlarm,
  expectErrorResponse,
  expectSuccessResponse,
  expectValidationError,
  validPatientUpdateData,
} from '../helpers/setup';

// ============================================================
// GET /api/patients/[id] Tests
// ============================================================

describe('GET /api/patients/[id]', () => {
  const mockPatient = createMockPatient({
    id: 1,
    vitals: [createMockVital()],
    alarms: [createMockAlarm()],
    notes: [
      {
        id: 1,
        content: 'Test note',
        createdAt: new Date(),
        author: {
          fullName: 'Test Nurse',
          role: 'staff_nurse',
        },
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.auditLog.create.mockResolvedValue({});
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 for unauthenticated requests', async () => {
      auth.mockResolvedValue(null);
      const { request, context } = createMockRequestWithParams({ id: '1' });

      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(401);
      expectErrorResponse(data, 401, 'AUTHENTICATION_ERROR');
    });

    test('allows staff_nurse to view patient details', async () => {
      auth.mockResolvedValue(createMockSession('staff_nurse'));
      const { request, context } = createMockRequestWithParams({ id: '1' });

      const response = await GET(request, context);

      expect(response.status).toBe(200);
    });

    test('allows physician to view patient details', async () => {
      auth.mockResolvedValue(createMockSession('physician'));
      const { request, context } = createMockRequestWithParams({ id: '1' });

      const response = await GET(request, context);

      expect(response.status).toBe(200);
    });

    test('allows admin to view patient details', async () => {
      auth.mockResolvedValue(createMockSession('admin'));
      const { request, context } = createMockRequestWithParams({ id: '1' });

      const response = await GET(request, context);

      expect(response.status).toBe(200);
    });
  });

  describe('Validation', () => {
    test('returns 400 for invalid patient ID (non-numeric)', async () => {
      const { request, context } = createMockRequestWithParams({ id: 'invalid' });

      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectValidationError(data, 'id', 'Invalid patient ID');
    });

    test('returns 400 for invalid patient ID (negative)', async () => {
      const { request, context } = createMockRequestWithParams({ id: '-1' });

      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
    });
  });

  describe('Not Found Handling', () => {
    test('returns 404 when patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);
      const { request, context } = createMockRequestWithParams({ id: '999' });

      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('Patient not found');
    });
  });

  describe('Response Format', () => {
    test('returns patient with all related data', async () => {
      const { request, context } = createMockRequestWithParams({ id: '1' });

      const response = await GET(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expectSuccessResponse(data);
      expect(data.data).toMatchObject({
        id: 1,
        mrn: 'MRN-001',
        name: 'Baby Doe',
        status: 'normal',
      });
      expect(data.data.bed).toBeDefined();
      expect(data.data.vitals).toBeDefined();
      expect(data.data.alarms).toBeDefined();
      expect(data.data.notes).toBeDefined();
    });

    test('includes last 100 vitals', async () => {
      const { request, context } = createMockRequestWithParams({ id: '1' });

      await GET(request, context);

      expect(prisma.patient.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            vitals: expect.objectContaining({
              take: 100,
            }),
          }),
        })
      );
    });

    test('includes only active alarms', async () => {
      const { request, context } = createMockRequestWithParams({ id: '1' });

      await GET(request, context);

      expect(prisma.patient.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            alarms: expect.objectContaining({
              where: { status: 'active' },
            }),
          }),
        })
      );
    });

    test('includes last 10 notes with author info', async () => {
      const { request, context } = createMockRequestWithParams({ id: '1' });

      await GET(request, context);

      expect(prisma.patient.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            notes: expect.objectContaining({
              take: 10,
              include: {
                author: {
                  select: { fullName: true, role: true },
                },
              },
            }),
          }),
        })
      );
    });
  });

  describe('Audit Logging', () => {
    test('creates audit log entry when viewing patient', async () => {
      const session = createMockSession('staff_nurse', 5);
      auth.mockResolvedValue(session);
      const { request, context } = createMockRequestWithParams({ id: '1' });

      await GET(request, context);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 5,
          action: 'view_patient',
          resource: 'patient',
          resourceId: 1,
        },
      });
    });
  });
});

// ============================================================
// PATCH /api/patients/[id] Tests
// ============================================================

describe('PATCH /api/patients/[id]', () => {
  const mockPatient = createMockPatient({ id: 1 });
  const mockBed = createMockBed({ id: 2, bedNumber: '02' });

  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('staff_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.patient.update.mockResolvedValue({ ...mockPatient, ...validPatientUpdateData });
    prisma.bed.findUnique.mockResolvedValue(mockBed);
    prisma.bed.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 for unauthenticated requests', async () => {
      auth.mockResolvedValue(null);
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: validPatientUpdateData,
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(401);
      expectErrorResponse(data, 401, 'AUTHENTICATION_ERROR');
    });

    test('allows staff_nurse to update patient', async () => {
      auth.mockResolvedValue(createMockSession('staff_nurse'));
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: validPatientUpdateData,
        }
      );

      const response = await PATCH(request, context);

      expect(response.status).toBe(200);
    });

    test('allows physician to update patient', async () => {
      auth.mockResolvedValue(createMockSession('physician'));
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: validPatientUpdateData,
        }
      );

      const response = await PATCH(request, context);

      expect(response.status).toBe(200);
    });
  });

  describe('Validation', () => {
    test('returns 400 for invalid patient ID', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: 'invalid' },
        {
          url: 'http://localhost:3000/api/patients/invalid',
          method: 'PATCH',
          body: validPatientUpdateData,
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectValidationError(data, 'id', 'Invalid patient ID');
    });

    test('returns 400 for invalid weight (too low)', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { currentWeight: 0.05 }, // Below 0.2 kg minimum
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for invalid weight (too high)', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { currentWeight: 15 }, // Above 10 kg maximum
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for invalid status', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { status: 'invalid_status' },
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for invalid dayOfLife (negative)', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { dayOfLife: -1 },
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for invalid dayOfLife (over 365)', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { dayOfLife: 400 },
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('accepts valid alarm limits', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: {
            alarmLimits: {
              spo2: [88, 95],
              pr: [100, 180],
              rr: [30, 70],
              temp: [36.0, 37.5],
            },
          },
        }
      );

      const response = await PATCH(request, context);

      expect(response.status).toBe(200);
    });
  });

  describe('Not Found Handling', () => {
    test('returns 404 when patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);
      const { request, context } = createMockRequestWithParams(
        { id: '999' },
        {
          url: 'http://localhost:3000/api/patients/999',
          method: 'PATCH',
          body: validPatientUpdateData,
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Bed Assignment', () => {
    test('updates bed assignment when bedNumber changes', async () => {
      const newBed = createMockBed({ id: 3, bedNumber: '03' });
      prisma.bed.findUnique.mockResolvedValue(newBed);

      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { bedNumber: '03' },
        }
      );

      await PATCH(request, context);

      // Should free old bed
      expect(prisma.bed.update).toHaveBeenCalledWith({
        where: { id: mockPatient.bedId },
        data: { status: 'available' },
      });

      // Should occupy new bed
      expect(prisma.bed.update).toHaveBeenCalledWith({
        where: { id: newBed.id },
        data: { status: 'occupied' },
      });

      // Should update patient's bedId
      expect(prisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bedId: newBed.id,
          }),
        })
      );
    });

    test('returns 400 when new bed does not exist', async () => {
      prisma.bed.findUnique.mockResolvedValue(null);
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { bedNumber: '99' },
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectValidationError(data, 'bedNumber', 'not found');
    });

    test('returns 400 when new bed is occupied by another patient', async () => {
      const occupiedBed = createMockBed({ id: 3, bedNumber: '03' });
      prisma.bed.findUnique.mockResolvedValue(occupiedBed);
      prisma.patient.findFirst.mockResolvedValue({
        id: 99,
        bedId: 3,
        dischargeDate: null,
      });

      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { bedNumber: '03' },
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectValidationError(data, 'bedNumber', 'occupied');
    });

    test('allows assigning patient to same bed they currently occupy', async () => {
      const currentBed = mockPatient.bed;
      prisma.bed.findUnique.mockResolvedValue(currentBed);
      prisma.patient.findFirst.mockResolvedValue(mockPatient);

      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { bedNumber: currentBed.bedNumber },
        }
      );

      const response = await PATCH(request, context);

      expect(response.status).toBe(200);
    });
  });

  describe('Update Operations', () => {
    test('updates only provided fields', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { currentWeight: 2.5 },
        }
      );

      await PATCH(request, context);

      expect(prisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            currentWeight: 2.5,
          },
        })
      );
    });

    test('stringifies alarm limits', async () => {
      const alarmLimits = {
        spo2: [88, 95],
        pr: [100, 180],
      };

      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: { alarmLimits },
        }
      );

      await PATCH(request, context);

      expect(prisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alarmLimits: JSON.stringify(alarmLimits),
          }),
        })
      );
    });

    test('returns updated patient data', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: validPatientUpdateData,
        }
      );

      const response = await PATCH(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expectSuccessResponse(data);
      expect(data.data).toMatchObject({
        name: validPatientUpdateData.name,
        currentWeight: validPatientUpdateData.currentWeight,
        status: validPatientUpdateData.status,
      });
    });
  });

  describe('Audit Logging', () => {
    test('creates audit log entry on successful update', async () => {
      const session = createMockSession('staff_nurse', 5);
      auth.mockResolvedValue(session);
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'PATCH',
          body: validPatientUpdateData,
        }
      );

      await PATCH(request, context);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 5,
          action: 'update_patient',
          resource: 'patient',
          resourceId: 1,
          details: JSON.stringify(validPatientUpdateData),
        },
      });
    });
  });
});

// ============================================================
// DELETE /api/patients/[id] Tests
// ============================================================

describe('DELETE /api/patients/[id]', () => {
  const mockPatient = createMockPatient({ id: 1 });

  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue(createMockSession('charge_nurse'));
    prisma.patient.findUnique.mockResolvedValue(mockPatient);
    prisma.patient.update.mockResolvedValue({ ...mockPatient, dischargeDate: new Date() });
    prisma.bed.update.mockResolvedValue({});
    prisma.alarm.updateMany.mockResolvedValue({ count: 2 });
    prisma.auditLog.create.mockResolvedValue({});
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 for unauthenticated requests', async () => {
      auth.mockResolvedValue(null);
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(401);
      expectErrorResponse(data, 401, 'AUTHENTICATION_ERROR');
    });

    test('returns 403 for staff_nurse (not authorized)', async () => {
      auth.mockResolvedValue(createMockSession('staff_nurse'));
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(403);
      expectErrorResponse(data, 403, 'AUTHORIZATION_ERROR');
    });

    test('allows charge_nurse to discharge patient', async () => {
      auth.mockResolvedValue(createMockSession('charge_nurse'));
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, context);

      expect(response.status).toBe(200);
    });

    test('allows physician to discharge patient', async () => {
      auth.mockResolvedValue(createMockSession('physician'));
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, context);

      expect(response.status).toBe(200);
    });

    test('allows admin to discharge patient', async () => {
      auth.mockResolvedValue(createMockSession('admin'));
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, context);

      expect(response.status).toBe(200);
    });
  });

  describe('Validation', () => {
    test('returns 400 for invalid patient ID', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: 'invalid' },
        {
          url: 'http://localhost:3000/api/patients/invalid',
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectValidationError(data, 'id', 'Invalid patient ID');
    });
  });

  describe('Not Found Handling', () => {
    test('returns 404 when patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);
      const { request, context } = createMockRequestWithParams(
        { id: '999' },
        {
          url: 'http://localhost:3000/api/patients/999',
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Discharge Operations', () => {
    test('marks patient as discharged (soft delete)', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      await DELETE(request, context);

      expect(prisma.patient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'discharged',
          dischargeDate: expect.any(Date),
          bedId: null,
        }),
      });
    });

    test('sets bed status to cleaning when patient has bed', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      await DELETE(request, context);

      expect(prisma.bed.update).toHaveBeenCalledWith({
        where: { id: mockPatient.bedId },
        data: { status: 'cleaning' },
      });
    });

    test('does not update bed when patient has no bed assigned', async () => {
      prisma.patient.findUnique.mockResolvedValue({ ...mockPatient, bedId: null });
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      await DELETE(request, context);

      expect(prisma.bed.update).not.toHaveBeenCalled();
    });

    test('resolves all active alarms', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      await DELETE(request, context);

      expect(prisma.alarm.updateMany).toHaveBeenCalledWith({
        where: { patientId: 1, status: 'active' },
        data: { status: 'resolved', resolvedAt: expect.any(Date) },
      });
    });

    test('returns success message', async () => {
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('Patient discharged successfully');
    });
  });

  describe('Audit Logging', () => {
    test('creates audit log entry on successful discharge', async () => {
      const session = createMockSession('charge_nurse', 5);
      auth.mockResolvedValue(session);
      const { request, context } = createMockRequestWithParams(
        { id: '1' },
        {
          url: 'http://localhost:3000/api/patients/1',
          method: 'DELETE',
        }
      );

      await DELETE(request, context);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 5,
          action: 'discharge_patient',
          resource: 'patient',
          resourceId: 1,
          details: JSON.stringify({ mrn: mockPatient.mrn, name: mockPatient.name }),
        },
      });
    });
  });
});
