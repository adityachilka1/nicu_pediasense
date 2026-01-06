// Structured logging for production
// Format: JSON for easy parsing by log aggregators (CloudWatch, DataDog, etc.)

// Log level types
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  env: string;
  [key: string]: unknown;
}

// Metadata type for logging
export interface LogMeta {
  requestId?: string;
  [key: string]: unknown;
}

// Request-like interface for logging
export interface LoggableRequest {
  method?: string;
  url?: string;
  headers?: {
    get?: (name: string) => string | null;
  };
}

// Error-like interface for exception logging
export interface LoggableError {
  message?: string;
  name?: string;
  stack?: string;
  code?: string;
  statusCode?: number;
}

// Timer interface
export interface Timer {
  elapsed: () => number;
}

// Logger interface
export interface Logger {
  error: (message: string, meta?: LogMeta) => void;
  warn: (message: string, meta?: LogMeta) => void;
  info: (message: string, meta?: LogMeta) => void;
  debug: (message: string, meta?: LogMeta) => void;
  request: (req: LoggableRequest, meta?: LogMeta) => void;
  response: (req: LoggableRequest, status: number, duration: number, meta?: LogMeta) => void;
  exception: (error: LoggableError, meta?: LogMeta) => void;
  audit: (action: string, meta?: LogMeta) => void;
}

// Global requestId declaration
declare global {
  // eslint-disable-next-line no-var
  var requestId: string | undefined;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
}

function sanitize<T extends Record<string, unknown>>(obj: T | null | undefined): T | null | undefined {
  if (!obj) return obj;
  const sensitive = ['password', 'token', 'secret', 'authorization', 'cookie', 'passwordHash'];
  const sanitized = { ...obj } as Record<string, unknown>;

  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key] as Record<string, unknown>);
    }
  }
  return sanitized as T;
}

function formatLog(level: LogLevel, message: string, meta: LogMeta = {}): string {
  const timestamp = new Date().toISOString();
  const requestId = meta.requestId || global.requestId || undefined;

  const logEntry: LogEntry = {
    timestamp,
    level,
    message,
    requestId,
    ...sanitize(meta),
    env: process.env.NODE_ENV || 'development',
  };

  // Remove undefined values
  (Object.keys(logEntry) as Array<keyof LogEntry>).forEach(key => {
    if (logEntry[key] === undefined) {
      delete logEntry[key];
    }
  });

  return JSON.stringify(logEntry);
}

export const logger: Logger = {
  error(message: string, meta: LogMeta = {}): void {
    if (shouldLog('error')) {
      console.error(formatLog('error', message, meta));
    }
  },

  warn(message: string, meta: LogMeta = {}): void {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, meta));
    }
  },

  info(message: string, meta: LogMeta = {}): void {
    if (shouldLog('info')) {
      console.log(formatLog('info', message, meta));
    }
  },

  debug(message: string, meta: LogMeta = {}): void {
    if (shouldLog('debug')) {
      console.log(formatLog('debug', message, meta));
    }
  },

  // Log API request
  request(req: LoggableRequest, meta: LogMeta = {}): void {
    this.info('API Request', {
      method: req.method,
      url: req.url,
      userAgent: req.headers?.get?.('user-agent'),
      ...meta,
    });
  },

  // Log API response
  response(req: LoggableRequest, status: number, duration: number, meta: LogMeta = {}): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this[level]('API Response', {
      method: req.method,
      url: req.url,
      status,
      duration: `${duration}ms`,
      ...meta,
    });
  },

  // Log errors with stack trace
  exception(error: LoggableError, meta: LogMeta = {}): void {
    this.error(error.message || 'Unknown error', {
      name: error.name,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
      ...meta,
    });
  },

  // Audit log for compliance
  audit(action: string, meta: LogMeta = {}): void {
    this.info(`AUDIT: ${action}`, {
      audit: true,
      action,
      ...meta,
    });
  },
};

// Request ID generator
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Performance timing helper
export function createTimer(): Timer {
  const start = Date.now();
  return {
    elapsed: (): number => Date.now() - start,
  };
}

export default logger;
