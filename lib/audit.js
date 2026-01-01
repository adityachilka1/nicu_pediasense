import { prisma } from './prisma';

/**
 * Create an audit log entry
 * @param {Object} params - Audit log parameters
 * @param {number} [params.userId] - User ID (optional for unauthenticated actions)
 * @param {string} params.action - Action performed (login_success, login_failed, view_patient, etc.)
 * @param {string} [params.resource] - Resource type (patient, alarm, user, etc.)
 * @param {number} [params.resourceId] - Resource ID
 * @param {string} [params.details] - JSON string with additional details
 * @param {string} [params.ipAddress] - Client IP address
 * @returns {Promise<Object>} - Created audit log entry
 */
export async function createAuditLog({
  userId,
  action,
  resource,
  resourceId,
  details,
  ipAddress,
}) {
  try {
    // Sanitize details to remove any sensitive information
    let sanitizedDetails = details;
    if (details) {
      try {
        const parsed = JSON.parse(details);
        // Remove any password-related fields
        delete parsed.password;
        delete parsed.passwordHash;
        delete parsed.newPassword;
        delete parsed.oldPassword;
        delete parsed.token;
        delete parsed.secret;

        // HIPAA: Redact PHI from logs - keep only minimal identifiers
        // MRN should be masked to last 4 characters
        if (parsed.mrn && typeof parsed.mrn === 'string') {
          parsed.mrn = `***${parsed.mrn.slice(-4)}`;
        }
        // Patient names should be redacted
        if (parsed.patientName) {
          parsed.patientName = '[REDACTED]';
        }
        if (parsed.name && parsed.name !== parsed.userName) {
          // Only redact if it appears to be a patient name (not user name)
          const looksLikePatientName = /BABY|INFANT|NEONATE/i.test(parsed.name) ||
            parsed.name.includes(',');
          if (looksLikePatientName) {
            parsed.name = '[REDACTED]';
          }
        }
        // Redact any SSN or DOB fields
        if (parsed.ssn) parsed.ssn = '[REDACTED]';
        if (parsed.dateOfBirth) parsed.dateOfBirth = '[REDACTED]';
        if (parsed.dob) parsed.dob = '[REDACTED]';
        if (parsed.motherName) parsed.motherName = '[REDACTED]';
        if (parsed.fatherName) parsed.fatherName = '[REDACTED]';
        if (parsed.guardianName) parsed.guardianName = '[REDACTED]';

        sanitizedDetails = JSON.stringify(parsed);
      } catch {
        // If not valid JSON, use as-is
        sanitizedDetails = details;
      }
    }

    const auditLog = await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        resource: resource || null,
        resourceId: resourceId || null,
        details: sanitizedDetails || null,
        ipAddress: ipAddress || null,
      },
    });

    return auditLog;
  } catch (error) {
    // Log to console but don't throw - audit logging should not break the main flow
    console.error('Failed to create audit log:', error);
    return null;
  }
}

/**
 * Log a PHI access event (HIPAA compliance)
 * @param {Object} params - PHI access parameters
 * @param {number} params.userId - User accessing PHI
 * @param {number} params.patientId - Patient whose PHI is accessed
 * @param {string} params.action - Type of access (view, update, delete)
 * @param {string[]} [params.fieldsAccessed] - Specific fields accessed
 * @param {string} [params.ipAddress] - Client IP address
 */
export async function logPHIAccess({
  userId,
  patientId,
  action,
  fieldsAccessed,
  ipAddress,
}) {
  return createAuditLog({
    userId,
    action: `phi_${action}`,
    resource: 'patient',
    resourceId: patientId,
    details: JSON.stringify({
      fieldsAccessed: fieldsAccessed || ['all'],
      timestamp: new Date().toISOString(),
      hipaaCategory: 'phi_access',
    }),
    ipAddress,
  });
}

/**
 * Get audit logs with filtering
 * @param {Object} params - Query parameters
 * @param {number} [params.userId] - Filter by user
 * @param {string} [params.action] - Filter by action
 * @param {string} [params.resource] - Filter by resource type
 * @param {Date} [params.since] - Filter by start date
 * @param {Date} [params.until] - Filter by end date
 * @param {number} [params.limit] - Max results (default 100)
 * @param {number} [params.offset] - Pagination offset
 * @returns {Promise<Object[]>} - Audit log entries
 */
export async function getAuditLogs({
  userId,
  action,
  resource,
  since,
  until,
  limit = 100,
  offset = 0,
}) {
  const where = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (resource) where.resource = resource;

  if (since || until) {
    where.createdAt = {};
    if (since) where.createdAt.gte = since;
    if (until) where.createdAt.lte = until;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 1000), // Cap at 1000
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, limit, offset };
}

/**
 * HIPAA-compliant PHI access report
 * @param {Object} params - Report parameters
 * @param {number} params.patientId - Patient to report on
 * @param {Date} params.since - Start date
 * @param {Date} params.until - End date
 */
export async function generatePHIAccessReport({ patientId, since, until }) {
  const logs = await prisma.auditLog.findMany({
    where: {
      resource: 'patient',
      resourceId: patientId,
      createdAt: {
        gte: since,
        lte: until,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    patientId,
    reportPeriod: { since, until },
    generatedAt: new Date().toISOString(),
    totalAccesses: logs.length,
    accessByUser: logs.reduce((acc, log) => {
      const userName = log.user?.fullName || 'System';
      acc[userName] = (acc[userName] || 0) + 1;
      return acc;
    }, {}),
    accessLog: logs.map(log => ({
      timestamp: log.createdAt,
      user: log.user?.fullName || 'System',
      role: log.user?.role || 'N/A',
      action: log.action,
      ipAddress: log.ipAddress,
    })),
  };
}
