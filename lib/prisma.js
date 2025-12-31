/**
 * Prisma Client Configuration
 *
 * Provides a singleton Prisma client with:
 * - Connection pooling for PostgreSQL (production)
 * - SQLite support for development
 * - Query logging and slow query detection
 * - Graceful shutdown handling
 * - Connection retry logic
 */

import { PrismaClient } from '@prisma/client';

// Global reference for development hot-reload
const globalForPrisma = globalThis;

// Configuration constants
const CONFIG = {
  // Connection pool settings (for PostgreSQL)
  pool: {
    // Maximum number of connections in the pool
    // Adjust based on your database server capacity
    connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    // Connection timeout in milliseconds
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
    // Idle connection timeout in milliseconds
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '60000', 10),
  },
  // Slow query threshold in milliseconds
  slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_MS || '1000', 10),
  // Enable query logging
  enableQueryLogging: process.env.DB_QUERY_LOGGING === 'true',
};

/**
 * Detect if using PostgreSQL based on DATABASE_URL
 */
function isPostgreSQL() {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

/**
 * Build connection URL with pooling parameters for PostgreSQL
 */
function buildConnectionUrl() {
  const baseUrl = process.env.DATABASE_URL;

  if (!baseUrl) {
    return 'file:./dev.db';
  }

  // For PostgreSQL, append connection pooling parameters if not present
  if (isPostgreSQL()) {
    const url = new URL(baseUrl);

    // Add connection pool parameters if not already set
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(CONFIG.pool.connectionLimit));
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', String(Math.ceil(CONFIG.pool.connectTimeout / 1000)));
    }

    return url.toString();
  }

  return baseUrl;
}

/**
 * Create and configure Prisma client
 */
function createPrismaClient() {
  const isProduction = process.env.NODE_ENV === 'production';
  const usePostgres = isPostgreSQL();

  // Determine log levels based on environment
  const logLevels = [];

  if (!isProduction) {
    // In development, log queries if enabled
    if (CONFIG.enableQueryLogging) {
      logLevels.push({ level: 'query', emit: 'event' });
    }
    logLevels.push({ level: 'warn', emit: 'stdout' });
    logLevels.push({ level: 'error', emit: 'stdout' });
  } else {
    // In production, only log warnings and errors
    logLevels.push({ level: 'warn', emit: 'stdout' });
    logLevels.push({ level: 'error', emit: 'stdout' });
    // Always log queries as events so we can detect slow queries
    logLevels.push({ level: 'query', emit: 'event' });
  }

  // Build Prisma client options
  const clientOptions = {
    log: logLevels,
    errorFormat: isProduction ? 'minimal' : 'pretty',
  };

  // For SQLite in development, use the adapter
  if (!usePostgres) {
    // Dynamic import of adapter for SQLite
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const adapter = new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL || 'file:./dev.db'
    });
    clientOptions.adapter = adapter;
  } else {
    // For PostgreSQL, set the connection URL with pooling params
    clientOptions.datasources = {
      db: {
        url: buildConnectionUrl(),
      },
    };
  }

  const client = new PrismaClient(clientOptions);

  // Set up query event listener for slow query detection
  client.$on('query', (e) => {
    const duration = e.duration;

    if (duration > CONFIG.slowQueryThreshold) {
      console.warn('[Prisma] Slow query detected:', {
        duration: `${duration}ms`,
        query: e.query.substring(0, 200) + (e.query.length > 200 ? '...' : ''),
        params: e.params ? e.params.substring(0, 100) : undefined,
      });
    }
  });

  return client;
}

/**
 * Get or create the Prisma client singleton
 */
function getPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();

  // In development, store in global to survive hot-reload
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

// Export the singleton client
export const prisma = getPrismaClient();

/**
 * Graceful shutdown handler
 * Call this when the application is shutting down
 */
export async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
    console.log('[Prisma] Disconnected successfully');
  } catch (error) {
    console.error('[Prisma] Error during disconnect:', error);
  }
}

/**
 * Health check function
 * Returns connection status and pool metrics
 */
export async function checkDatabaseHealth() {
  const startTime = Date.now();

  try {
    // Simple query to verify connection
    await prisma.$queryRaw`SELECT 1`;

    const latency = Date.now() - startTime;

    return {
      status: 'healthy',
      latency: `${latency}ms`,
      database: isPostgreSQL() ? 'postgresql' : 'sqlite',
      poolSize: isPostgreSQL() ? CONFIG.pool.connectionLimit : 1,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: process.env.NODE_ENV === 'production'
        ? 'Database connection failed'
        : error.message,
      database: isPostgreSQL() ? 'postgresql' : 'sqlite',
    };
  }
}

/**
 * Execute a function with retry logic
 * Useful for handling transient database errors
 *
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the function
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 2000,
    retryableErrors = ['P1001', 'P1002', 'P1008', 'P1017'], // Connection errors
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const errorCode = error.code || '';
      const isRetryable = retryableErrors.some(code => errorCode.includes(code));

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      console.warn(`[Prisma] Retry attempt ${attempt}/${maxRetries} after error:`, {
        code: errorCode,
        message: error.message,
        delay: `${delay}ms`,
      });

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Execute a transaction with retry logic
 *
 * @param {Function} fn - Transaction function
 * @param {Object} options - Transaction and retry options
 * @returns {Promise} - Result of the transaction
 */
export async function transactionWithRetry(fn, options = {}) {
  const { maxRetries = 3, timeout = 10000, ...retryOptions } = options;

  return withRetry(async () => {
    return prisma.$transaction(fn, {
      timeout,
      maxWait: CONFIG.pool.connectTimeout,
    });
  }, { maxRetries, ...retryOptions });
}

// Set up graceful shutdown handlers
// Only run in Node.js runtime (not Edge Runtime or during static analysis)
// Using globalThis check to avoid Turbopack static analysis flagging process.on
if (typeof globalThis !== 'undefined' && typeof globalThis.process !== 'undefined' && globalThis.process.on) {
  const nodeProcess = globalThis.process;

  const shutdown = async (signal) => {
    console.log(`[Prisma] Received ${signal}, shutting down...`);
    await disconnectPrisma();
  };

  // Handle various termination signals
  nodeProcess.on('beforeExit', () => shutdown('beforeExit'));
  nodeProcess.on('SIGINT', () => shutdown('SIGINT'));
  nodeProcess.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors to ensure cleanup
  nodeProcess.on('uncaughtException', async (error) => {
    console.error('[Prisma] Uncaught exception:', error);
    await disconnectPrisma();
    nodeProcess.exit(1);
  });
}

export default prisma;
