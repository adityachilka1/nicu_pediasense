// Structured logging for production
// Format: JSON for easy parsing by log aggregators (CloudWatch, DataDog, etc.)

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level) {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
}

function sanitize(obj) {
  if (!obj) return obj;
  const sensitive = ['password', 'token', 'secret', 'authorization', 'cookie', 'passwordHash'];
  const sanitized = { ...obj };

  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  return sanitized;
}

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const requestId = meta.requestId || global.requestId || undefined;

  const logEntry = {
    timestamp,
    level,
    message,
    requestId,
    ...sanitize(meta),
    env: process.env.NODE_ENV || 'development',
  };

  // Remove undefined values
  Object.keys(logEntry).forEach(key => {
    if (logEntry[key] === undefined) {
      delete logEntry[key];
    }
  });

  return JSON.stringify(logEntry);
}

export const logger = {
  error(message, meta = {}) {
    if (shouldLog('error')) {
      console.error(formatLog('error', message, meta));
    }
  },

  warn(message, meta = {}) {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, meta));
    }
  },

  info(message, meta = {}) {
    if (shouldLog('info')) {
      console.log(formatLog('info', message, meta));
    }
  },

  debug(message, meta = {}) {
    if (shouldLog('debug')) {
      console.log(formatLog('debug', message, meta));
    }
  },

  // Log API request
  request(req, meta = {}) {
    this.info('API Request', {
      method: req.method,
      url: req.url,
      userAgent: req.headers?.get?.('user-agent'),
      ...meta,
    });
  },

  // Log API response
  response(req, status, duration, meta = {}) {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this[level]('API Response', {
      method: req.method,
      url: req.url,
      status,
      duration: `${duration}ms`,
      ...meta,
    });
  },

  // Log errors with stack trace
  exception(error, meta = {}) {
    this.error(error.message || 'Unknown error', {
      name: error.name,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
      ...meta,
    });
  },

  // Audit log for compliance
  audit(action, meta = {}) {
    this.info(`AUDIT: ${action}`, {
      audit: true,
      action,
      ...meta,
    });
  },
};

// Request ID generator
export function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Performance timing helper
export function createTimer() {
  const start = Date.now();
  return {
    elapsed: () => Date.now() - start,
  };
}

export default logger;
