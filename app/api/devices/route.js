import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createDeviceSchema, updateDeviceSchema, validateRequest } from '@/lib/validation';
import { withErrorHandler, ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, sanitizeInput, requireAuth, requireRole } from '@/lib/security';

// Default alarm limit presets for NICU
const DEFAULT_PRESETS = {
  preterm_24_28: {
    displayName: 'Preterm (24-28 weeks)',
    description: 'Alarm limits for extremely preterm infants (24-28 weeks gestational age)',
    limits: {
      spo2: [88, 95],
      pr: [100, 190],
      rr: [30, 80],
      temp: [36.3, 37.3],
    },
  },
  preterm_28_32: {
    displayName: 'Preterm (28-32 weeks)',
    description: 'Alarm limits for very preterm infants (28-32 weeks gestational age)',
    limits: {
      spo2: [88, 96],
      pr: [100, 180],
      rr: [30, 70],
      temp: [36.4, 37.4],
    },
  },
  preterm_32_37: {
    displayName: 'Preterm (32-37 weeks)',
    description: 'Alarm limits for moderate to late preterm infants (32-37 weeks gestational age)',
    limits: {
      spo2: [90, 98],
      pr: [90, 170],
      rr: [25, 60],
      temp: [36.5, 37.5],
    },
  },
  term: {
    displayName: 'Term Infant',
    description: 'Alarm limits for term infants (37+ weeks gestational age)',
    limits: {
      spo2: [92, 100],
      pr: [80, 160],
      rr: [20, 60],
      temp: [36.5, 37.5],
    },
  },
};

// GET /api/devices - List all devices or devices for a specific bed
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const bedId = searchParams.get('bedId');
  const bedNumber = searchParams.get('bedNumber');
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const includeStats = searchParams.get('includeStats') === 'true';

  // Build where clause
  const where = {};

  // Filter by bed (either by ID or bed number)
  if (bedId) {
    where.bedId = parseInt(bedId, 10);
  } else if (bedNumber) {
    const bed = await prisma.bed.findUnique({
      where: { bedNumber },
    });
    if (bed) {
      where.bedId = bed.id;
    } else {
      // Return empty if bed not found
      return NextResponse.json({
        data: [],
        meta: {
          total: 0,
          timestamp: new Date().toISOString(),
          filters: { bedNumber },
        },
      });
    }
  }

  // Filter by device type
  if (type) {
    where.type = type;
  }

  // Filter by status
  if (status) {
    where.status = status;
  }

  const devices = await prisma.device.findMany({
    where,
    include: {
      bed: {
        include: {
          patient: {
            select: {
              id: true,
              mrn: true,
              name: true,
              status: true,
            },
          },
        },
      },
      _count: includeStats ? {
        select: { logs: true },
      } : false,
    },
    orderBy: [
      { status: 'asc' },
      { type: 'asc' },
      { name: 'asc' },
    ],
  });

  // Transform response
  const transformed = devices.map((device) => {
    const config = device.config ? JSON.parse(device.config) : null;

    return {
      id: device.id,
      serialNumber: device.serialNumber,
      name: device.name,
      type: device.type,
      manufacturer: device.manufacturer,
      model: device.model,
      status: device.status,
      firmwareVersion: device.firmwareVersion,
      config,
      bed: device.bed ? {
        id: device.bed.id,
        bedNumber: device.bed.bedNumber,
        patient: device.bed.patient,
      } : null,
      calibration: {
        last: device.lastCalibration,
        next: device.nextCalibration,
      },
      maintenance: {
        last: device.lastMaintenance,
        next: device.nextMaintenance,
      },
      lastPingAt: device.lastPingAt,
      logCount: includeStats ? device._count?.logs : undefined,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  });

  // Calculate stats if requested
  let stats = undefined;
  if (includeStats) {
    const allDevices = await prisma.device.groupBy({
      by: ['status'],
      _count: true,
    });

    const byType = await prisma.device.groupBy({
      by: ['type'],
      _count: true,
    });

    stats = {
      byStatus: Object.fromEntries(
        allDevices.map((d) => [d.status, d._count])
      ),
      byType: Object.fromEntries(
        byType.map((d) => [d.type, d._count])
      ),
    };
  }

  logger.info('Fetched devices', {
    userId: session.user.id,
    count: transformed.length,
    filters: { bedId, bedNumber, type, status },
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: transformed,
    meta: {
      total: transformed.length,
      timestamp: new Date().toISOString(),
      filters: { bedId, bedNumber, type, status },
      stats,
    },
  });
});

// POST /api/devices - Register a new device or update status
export const POST = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();

  // Only admins and biomedical engineers can register devices
  requireRole(session, ['admin', 'Admin', 'physician', 'Physician', 'charge_nurse', 'Charge Nurse']);

  // Rate limiting (stricter for mutations)
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'heavy');

  // Parse and validate request body
  const rawBody = await request.json();
  const body = sanitizeInput(rawBody);

  // Check if this is an update (has id or serialNumber for existing device)
  const isUpdate = body.id || body.updateSerial;

  if (isUpdate) {
    // Update existing device
    const deviceId = body.id;
    const updateSerial = body.updateSerial;

    let device;
    if (deviceId) {
      device = await prisma.device.findUnique({ where: { id: deviceId } });
    } else if (updateSerial) {
      device = await prisma.device.findUnique({ where: { serialNumber: updateSerial } });
    }

    if (!device) {
      throw new NotFoundError('Device');
    }

    // Validate update data
    const validation = validateRequest(updateDeviceSchema, body);
    if (!validation.success) {
      throw new ValidationError(validation.errors);
    }

    const updateData = {};

    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.type !== undefined) updateData.type = validation.data.type;
    if (validation.data.manufacturer !== undefined) updateData.manufacturer = validation.data.manufacturer;
    if (validation.data.model !== undefined) updateData.model = validation.data.model;
    if (validation.data.status !== undefined) updateData.status = validation.data.status;
    if (validation.data.firmwareVersion !== undefined) updateData.firmwareVersion = validation.data.firmwareVersion;
    if (validation.data.bedId !== undefined) updateData.bedId = validation.data.bedId;
    if (validation.data.config !== undefined) {
      updateData.config = JSON.stringify(validation.data.config);
    }
    if (validation.data.lastCalibration !== undefined) {
      updateData.lastCalibration = validation.data.lastCalibration ? new Date(validation.data.lastCalibration) : null;
    }
    if (validation.data.nextCalibration !== undefined) {
      updateData.nextCalibration = validation.data.nextCalibration ? new Date(validation.data.nextCalibration) : null;
    }
    if (validation.data.lastMaintenance !== undefined) {
      updateData.lastMaintenance = validation.data.lastMaintenance ? new Date(validation.data.lastMaintenance) : null;
    }
    if (validation.data.nextMaintenance !== undefined) {
      updateData.nextMaintenance = validation.data.nextMaintenance ? new Date(validation.data.nextMaintenance) : null;
    }

    // Update last ping if status is being updated
    if (validation.data.status) {
      updateData.lastPingAt = new Date();
    }

    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: updateData,
      include: { bed: true },
    });

    // Create log entry for status change
    if (validation.data.status && validation.data.status !== device.status) {
      await prisma.deviceLog.create({
        data: {
          deviceId: device.id,
          level: validation.data.status === 'error' ? 'error' : 'info',
          category: 'status_change',
          message: `Device status changed from ${device.status} to ${validation.data.status}`,
          userId: parseInt(session.user.id),
          details: JSON.stringify({
            previousStatus: device.status,
            newStatus: validation.data.status,
          }),
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'update_device',
        resource: 'device',
        resourceId: device.id,
        details: JSON.stringify({
          serialNumber: device.serialNumber,
          updates: Object.keys(updateData),
        }),
      },
    });

    logger.audit('Device updated', {
      userId: session.user.id,
      deviceId: device.id,
      serialNumber: device.serialNumber,
      updates: Object.keys(updateData),
      duration: `${timer.elapsed()}ms`,
    });

    return NextResponse.json({
      data: {
        ...updatedDevice,
        config: updatedDevice.config ? JSON.parse(updatedDevice.config) : null,
      },
      meta: {
        action: 'updated',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Create new device
  const validation = validateRequest(createDeviceSchema, body);
  if (!validation.success) {
    throw new ValidationError(validation.errors);
  }

  const {
    serialNumber,
    name,
    type,
    manufacturer,
    model,
    bedId,
    status,
    firmwareVersion,
    config,
    lastCalibration,
    nextCalibration,
    lastMaintenance,
    nextMaintenance,
  } = validation.data;

  // Check for duplicate serial number
  const existingDevice = await prisma.device.findUnique({
    where: { serialNumber },
  });

  if (existingDevice) {
    throw new ConflictError(`Device with serial number ${serialNumber} already exists`);
  }

  // Validate bed if provided
  if (bedId) {
    const bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) {
      throw new ValidationError([{ field: 'bedId', message: 'Bed not found' }]);
    }
  }

  // Create the device
  const device = await prisma.device.create({
    data: {
      serialNumber,
      name,
      type,
      manufacturer,
      model,
      bedId,
      status: status || 'active',
      firmwareVersion,
      config: config ? JSON.stringify(config) : null,
      lastCalibration: lastCalibration ? new Date(lastCalibration) : null,
      nextCalibration: nextCalibration ? new Date(nextCalibration) : null,
      lastMaintenance: lastMaintenance ? new Date(lastMaintenance) : null,
      nextMaintenance: nextMaintenance ? new Date(nextMaintenance) : null,
      lastPingAt: new Date(),
    },
    include: { bed: true },
  });

  // Create initial log entry
  await prisma.deviceLog.create({
    data: {
      deviceId: device.id,
      level: 'info',
      category: 'status_change',
      message: `Device registered: ${name} (${type})`,
      userId: parseInt(session.user.id),
      details: JSON.stringify({
        serialNumber,
        type,
        manufacturer,
        model,
      }),
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: parseInt(session.user.id),
      action: 'register_device',
      resource: 'device',
      resourceId: device.id,
      details: JSON.stringify({ serialNumber, name, type, bedId }),
    },
  });

  logger.audit('Device registered', {
    userId: session.user.id,
    deviceId: device.id,
    serialNumber,
    type,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      ...device,
      config: device.config ? JSON.parse(device.config) : null,
    },
    meta: {
      action: 'created',
      timestamp: new Date().toISOString(),
    },
  }, { status: 201 });
});
