import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { withErrorHandler } from '@/lib/errors';
import logger, { createTimer } from '@/lib/logger';
import { rateLimit, getClientIP, requireAuth } from '@/lib/security';

// Helper to determine current shift based on time
function getCurrentShift(date = new Date()) {
  const hours = date.getHours();
  if (hours >= 7 && hours < 15) return 'day';
  if (hours >= 15 && hours < 23) return 'evening';
  return 'night';
}

// Helper to get shift start date
function getShiftDate(date = new Date()) {
  const shiftDate = new Date(date);
  // If it's before 7am, it's still the previous day's night shift
  if (shiftDate.getHours() < 7) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }
  shiftDate.setHours(0, 0, 0, 0);
  return shiftDate;
}

// GET /api/handoff/current - Get current shift patients for handoff
export const GET = withErrorHandler(async (request) => {
  const timer = createTimer();
  const session = await auth();
  requireAuth(session);

  // Rate limiting
  const clientIP = getClientIP(request);
  rateLimit(clientIP, 'api');

  const { searchParams } = new URL(request.url);
  const shiftOverride = searchParams.get('shift');

  const currentShift = shiftOverride || getCurrentShift();
  const currentShiftDate = getShiftDate();

  // Get all active patients with their latest vitals and handoff notes
  const patients = await prisma.patient.findMany({
    where: {
      dischargeDate: null, // Only active patients
    },
    include: {
      bed: {
        select: {
          bedNumber: true,
        },
      },
      vitals: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
      alarms: {
        where: { status: 'active' },
        select: {
          id: true,
          type: true,
          parameter: true,
          message: true,
          triggeredAt: true,
        },
        orderBy: { triggeredAt: 'desc' },
        take: 5,
      },
      handoffNotes: {
        where: {
          shift: currentShift,
          shiftDate: {
            gte: currentShiftDate,
            lt: new Date(currentShiftDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              initials: true,
            },
          },
          acknowledgedBy: {
            select: {
              id: true,
              fullName: true,
              initials: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      orders: {
        where: {
          status: { in: ['PENDING', 'ACTIVE', 'IN_PROGRESS'] },
        },
        select: {
          id: true,
          name: true,
          category: true,
          priority: true,
          status: true,
        },
        take: 5,
      },
    },
    orderBy: [
      { status: 'asc' }, // Critical first
      { bed: { bedNumber: 'asc' } },
    ],
  });

  // Transform patients for handoff view
  const transformed = patients.map(patient => {
    const latestVitals = patient.vitals[0] || {};
    const handoffNote = patient.handoffNotes[0] || null;
    const alarmLimits = patient.alarmLimits ? JSON.parse(patient.alarmLimits) : {};

    return {
      id: patient.id,
      bed: patient.bed?.bedNumber || '--',
      mrn: patient.mrn,
      name: patient.name,
      gestationalAge: patient.gestationalAge,
      dayOfLife: patient.dayOfLife,
      currentWeight: patient.currentWeight,
      birthWeight: patient.birthWeight,
      status: patient.status,
      admitDate: patient.admitDate,
      // Latest vitals
      vitals: {
        heartRate: latestVitals.heartRate,
        spo2: latestVitals.spo2,
        respRate: latestVitals.respRate,
        temperature: latestVitals.temperature,
        fio2: latestVitals.fio2,
        bpSystolic: latestVitals.bpSystolic,
        bpDiastolic: latestVitals.bpDiastolic,
        bpMean: latestVitals.bpMean,
        recordedAt: latestVitals.recordedAt,
      },
      alarmLimits,
      activeAlarms: patient.alarms,
      activeAlarmCount: patient.alarms.length,
      // Handoff info
      handoffNote: handoffNote ? {
        id: handoffNote.id,
        status: handoffNote.status,
        situation: handoffNote.situation,
        background: handoffNote.background,
        assessment: handoffNote.assessment,
        recommendation: handoffNote.recommendation,
        acuity: handoffNote.acuity,
        keyEvents: handoffNote.keyEvents ? JSON.parse(handoffNote.keyEvents) : [],
        pendingTasks: handoffNote.pendingTasks ? JSON.parse(handoffNote.pendingTasks) : [],
        alertsFlags: handoffNote.alertsFlags ? JSON.parse(handoffNote.alertsFlags) : [],
        author: handoffNote.author,
        acknowledgedBy: handoffNote.acknowledgedBy,
        acknowledgedAt: handoffNote.acknowledgedAt,
        createdAt: handoffNote.createdAt,
      } : null,
      hasHandoffNote: !!handoffNote,
      handoffStatus: handoffNote?.status || 'none',
      // Active orders
      pendingOrders: patient.orders,
      pendingOrderCount: patient.orders.length,
    };
  });

  // Group patients by status
  const criticalPatients = transformed.filter(p => p.status === 'critical');
  const warningPatients = transformed.filter(p => p.status === 'warning');
  const stablePatients = transformed.filter(p => p.status === 'normal');

  // Get handoff summary for current shift
  const handoffSummary = await prisma.handoffNote.groupBy({
    by: ['status'],
    where: {
      shift: currentShift,
      shiftDate: {
        gte: currentShiftDate,
        lt: new Date(currentShiftDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    _count: true,
  });

  logger.info('Fetched current shift patients', {
    userId: session.user.id,
    shift: currentShift,
    patientCount: transformed.length,
    critical: criticalPatients.length,
    warning: warningPatients.length,
    stable: stablePatients.length,
    duration: `${timer.elapsed()}ms`,
  });

  return NextResponse.json({
    data: {
      patients: transformed,
      grouped: {
        critical: criticalPatients,
        warning: warningPatients,
        stable: stablePatients,
      },
    },
    meta: {
      currentShift,
      currentShiftDate: currentShiftDate.toISOString(),
      totalPatients: transformed.length,
      criticalCount: criticalPatients.length,
      warningCount: warningPatients.length,
      stableCount: stablePatients.length,
      handoffSummary: handoffSummary.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      shifts: {
        day: { start: '07:00', end: '15:00' },
        evening: { start: '15:00', end: '23:00' },
        night: { start: '23:00', end: '07:00' },
      },
      timestamp: new Date().toISOString(),
    },
  });
});
