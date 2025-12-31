import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/prisma';
import { getRateLimiterStatus } from '@/lib/rate-limiter';

// GET /api/health - Health check endpoint
export async function GET() {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {},
  };

  // Check database connection with pool info
  try {
    const dbHealth = await checkDatabaseHealth();
    health.checks.database = dbHealth;

    if (dbHealth.status !== 'healthy') {
      health.status = 'unhealthy';
    }
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = {
      status: 'unhealthy',
      error: process.env.NODE_ENV === 'production' ? 'Connection failed' : error.message,
    };
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: 'healthy',
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  };

  // Memory warning threshold (500MB)
  if (memUsage.heapUsed > 500 * 1024 * 1024) {
    health.checks.memory.status = 'warning';
    health.status = health.status === 'healthy' ? 'degraded' : health.status;
  }

  // Check rate limiter status
  try {
    const rateLimiterStatus = getRateLimiterStatus();
    health.checks.rateLimiter = {
      status: 'healthy',
      store: rateLimiterStatus.store,
      redisConnected: rateLimiterStatus.redisConnected,
      memoryStoreSize: rateLimiterStatus.memoryStoreSize,
    };

    // Warn if using memory store in production
    if (process.env.NODE_ENV === 'production' && rateLimiterStatus.store === 'memory') {
      health.checks.rateLimiter.status = 'warning';
      health.checks.rateLimiter.message = 'Using in-memory rate limiting; configure Redis for distributed deployments';
      health.status = health.status === 'healthy' ? 'degraded' : health.status;
    }
  } catch (error) {
    health.checks.rateLimiter = {
      status: 'error',
      error: error.message,
    };
  }

  // Uptime
  health.uptime = `${Math.round(process.uptime())}s`;
  health.responseTime = `${Date.now() - startTime}ms`;

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
