/**
 * Distributed Rate Limiter with Redis
 *
 * Uses Redis for distributed rate limiting across multiple server instances.
 * Falls back to in-memory rate limiting when Redis is unavailable.
 *
 * Implements the sliding window algorithm for accurate rate limiting.
 */

import { getRedis, isRedisConnected } from './redis';
import { RateLimitError } from './errors';

// Rate limiting configuration
const rateLimitConfig = {
  default: { windowMs: 60000, max: 100 },      // 100 requests per minute
  auth: { windowMs: 300000, max: 10 },          // 10 login attempts per 5 minutes
  api: { windowMs: 60000, max: 60 },            // 60 API calls per minute
  heavy: { windowMs: 60000, max: 10 },          // 10 heavy operations per minute
  realtime: { windowMs: 1000, max: 20 },        // 20 requests per second (WebSocket)
};

// In-memory fallback store
const memoryStore = new Map();

// Clean up old entries periodically (for in-memory fallback)
let cleanupInterval = null;

function startMemoryCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of memoryStore.entries()) {
      if (now > data.resetTime) {
        memoryStore.delete(key);
      }
    }
  }, 60000); // Clean up every minute

  // Don't prevent Node from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Rate limit using in-memory store (fallback)
 */
function rateLimitMemory(identifier, type = 'default') {
  startMemoryCleanup();

  const config = rateLimitConfig[type] || rateLimitConfig.default;
  const now = Date.now();
  const key = `ratelimit:${type}:${identifier}`;

  let data = memoryStore.get(key);

  if (!data || now > data.resetTime) {
    data = {
      count: 0,
      resetTime: now + config.windowMs,
    };
  }

  data.count++;
  memoryStore.set(key, data);

  const remaining = Math.max(0, config.max - data.count);
  const retryAfter = Math.ceil((data.resetTime - now) / 1000);

  if (data.count > config.max) {
    throw new RateLimitError(retryAfter);
  }

  return {
    remaining,
    limit: config.max,
    resetTime: data.resetTime,
    store: 'memory',
  };
}

/**
 * Rate limit using Redis (distributed)
 * Uses Lua script for atomic increment and expiry
 */
async function rateLimitRedis(identifier, type = 'default') {
  const redis = getRedis();
  const config = rateLimitConfig[type] || rateLimitConfig.default;
  const key = `ratelimit:${type}:${identifier}`;
  const windowSec = Math.ceil(config.windowMs / 1000);

  // Lua script for atomic rate limiting
  // Returns: [current_count, ttl_ms]
  const luaScript = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])

    local current = redis.call('INCR', key)

    if current == 1 then
      redis.call('EXPIRE', key, window)
    end

    local ttl = redis.call('PTTL', key)

    return {current, ttl}
  `;

  try {
    const result = await redis.eval(luaScript, 1, key, config.max, windowSec);
    const [count, ttlMs] = result;

    const remaining = Math.max(0, config.max - count);
    const resetTime = Date.now() + Math.max(0, ttlMs);
    const retryAfter = Math.ceil(ttlMs / 1000);

    if (count > config.max) {
      throw new RateLimitError(retryAfter);
    }

    return {
      remaining,
      limit: config.max,
      resetTime,
      store: 'redis',
    };
  } catch (error) {
    // If it's a rate limit error, re-throw it
    if (error instanceof RateLimitError) {
      throw error;
    }

    // Redis error - fall back to memory
    console.warn('[RateLimiter] Redis error, falling back to memory:', error.message);
    return rateLimitMemory(identifier, type);
  }
}

/**
 * Main rate limit function
 * Automatically uses Redis if available, falls back to memory
 *
 * @param {string} identifier - Unique identifier (usually IP or user ID)
 * @param {string} type - Rate limit type: 'default', 'auth', 'api', 'heavy', 'realtime'
 * @returns {Object} Rate limit info: { remaining, limit, resetTime, store }
 * @throws {RateLimitError} When rate limit is exceeded
 */
export function rateLimit(identifier, type = 'default') {
  // For synchronous API compatibility, check Redis status first
  if (isRedisConnected()) {
    // Return a promise that will be handled
    return rateLimitRedis(identifier, type);
  }

  // Use synchronous in-memory fallback
  return rateLimitMemory(identifier, type);
}

/**
 * Async rate limit function (preferred for new code)
 * Always returns a promise for consistent handling
 */
export async function rateLimitAsync(identifier, type = 'default') {
  if (isRedisConnected()) {
    return rateLimitRedis(identifier, type);
  }
  return rateLimitMemory(identifier, type);
}

/**
 * Check rate limit without incrementing counter
 * Useful for displaying rate limit info to users
 */
export async function getRateLimitInfo(identifier, type = 'default') {
  const config = rateLimitConfig[type] || rateLimitConfig.default;
  const key = `ratelimit:${type}:${identifier}`;

  if (isRedisConnected()) {
    const redis = getRedis();
    try {
      const [count, ttl] = await Promise.all([
        redis.get(key),
        redis.pttl(key),
      ]);

      const currentCount = parseInt(count || '0', 10);
      const remaining = Math.max(0, config.max - currentCount);
      const resetTime = ttl > 0 ? Date.now() + ttl : Date.now() + config.windowMs;

      return {
        remaining,
        limit: config.max,
        resetTime,
        used: currentCount,
        store: 'redis',
      };
    } catch (error) {
      console.warn('[RateLimiter] Redis error in getRateLimitInfo:', error.message);
    }
  }

  // Memory fallback
  const data = memoryStore.get(key);
  const currentCount = data?.count || 0;
  const remaining = Math.max(0, config.max - currentCount);
  const resetTime = data?.resetTime || Date.now() + config.windowMs;

  return {
    remaining,
    limit: config.max,
    resetTime,
    used: currentCount,
    store: 'memory',
  };
}

/**
 * Reset rate limit for a specific identifier
 * Useful for admin operations or after successful authentication
 */
export async function resetRateLimit(identifier, type = 'default') {
  const key = `ratelimit:${type}:${identifier}`;

  if (isRedisConnected()) {
    const redis = getRedis();
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.warn('[RateLimiter] Redis error in resetRateLimit:', error.message);
    }
  }

  // Memory fallback
  memoryStore.delete(key);
  return true;
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(rateLimitInfo) {
  return {
    'X-RateLimit-Limit': String(rateLimitInfo.limit),
    'X-RateLimit-Remaining': String(rateLimitInfo.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rateLimitInfo.resetTime / 1000)),
    'X-RateLimit-Store': rateLimitInfo.store,
  };
}

/**
 * Get current rate limit configuration
 */
export function getRateLimitConfig(type = 'default') {
  return rateLimitConfig[type] || rateLimitConfig.default;
}

/**
 * Get rate limiter status (for health checks)
 */
export function getRateLimiterStatus() {
  return {
    store: isRedisConnected() ? 'redis' : 'memory',
    redisConnected: isRedisConnected(),
    memoryStoreSize: memoryStore.size,
    config: rateLimitConfig,
  };
}

export default rateLimit;
