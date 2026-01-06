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
import type { Redis } from 'ioredis';

// Rate limit types
export type RateLimitType = 'default' | 'auth' | 'api' | 'heavy' | 'realtime';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetTime: number;
  store: 'redis' | 'memory';
}

export interface RateLimitInfoWithUsage extends RateLimitInfo {
  used: number;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-Store': string;
}

export interface RateLimiterStatus {
  store: 'redis' | 'memory';
  redisConnected: boolean;
  memoryStoreSize: number;
  config: Record<RateLimitType, RateLimitConfig>;
}

// Memory store data structure
interface MemoryStoreEntry {
  count: number;
  resetTime: number;
}

// Rate limiting configuration
const rateLimitConfig: Record<RateLimitType, RateLimitConfig> = {
  default: { windowMs: 60000, max: 100 },      // 100 requests per minute
  auth: { windowMs: 300000, max: 10 },          // 10 login attempts per 5 minutes
  api: { windowMs: 60000, max: 60 },            // 60 API calls per minute
  heavy: { windowMs: 60000, max: 10 },          // 10 heavy operations per minute
  realtime: { windowMs: 1000, max: 20 },        // 20 requests per second (WebSocket)
};

// In-memory fallback store
const memoryStore = new Map<string, MemoryStoreEntry>();

// Clean up old entries periodically (for in-memory fallback)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startMemoryCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const entries = Array.from(memoryStore.entries());
    for (const [key, data] of entries) {
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
function rateLimitMemory(identifier: string, type: RateLimitType = 'default'): RateLimitInfo {
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
async function rateLimitRedis(identifier: string, type: RateLimitType = 'default'): Promise<RateLimitInfo> {
  const redis = getRedis() as Redis | null;
  if (!redis) {
    return rateLimitMemory(identifier, type);
  }

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
    const result = await redis.eval(luaScript, 1, key, config.max, windowSec) as [number, number];
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
    console.warn('[RateLimiter] Redis error, falling back to memory:', (error as Error).message);
    return rateLimitMemory(identifier, type);
  }
}

/**
 * Main rate limit function
 * Automatically uses Redis if available, falls back to memory
 *
 * @param identifier - Unique identifier (usually IP or user ID)
 * @param type - Rate limit type: 'default', 'auth', 'api', 'heavy', 'realtime'
 * @returns Rate limit info: { remaining, limit, resetTime, store }
 * @throws RateLimitError When rate limit is exceeded
 */
export function rateLimit(identifier: string, type: RateLimitType = 'default'): RateLimitInfo | Promise<RateLimitInfo> {
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
export async function rateLimitAsync(identifier: string, type: RateLimitType = 'default'): Promise<RateLimitInfo> {
  if (isRedisConnected()) {
    return rateLimitRedis(identifier, type);
  }
  return rateLimitMemory(identifier, type);
}

/**
 * Check rate limit without incrementing counter
 * Useful for displaying rate limit info to users
 */
export async function getRateLimitInfo(identifier: string, type: RateLimitType = 'default'): Promise<RateLimitInfoWithUsage> {
  const config = rateLimitConfig[type] || rateLimitConfig.default;
  const key = `ratelimit:${type}:${identifier}`;

  if (isRedisConnected()) {
    const redis = getRedis() as Redis | null;
    if (redis) {
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
        console.warn('[RateLimiter] Redis error in getRateLimitInfo:', (error as Error).message);
      }
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
export async function resetRateLimit(identifier: string, type: RateLimitType = 'default'): Promise<boolean> {
  const key = `ratelimit:${type}:${identifier}`;

  if (isRedisConnected()) {
    const redis = getRedis() as Redis | null;
    if (redis) {
      try {
        await redis.del(key);
        return true;
      } catch (error) {
        console.warn('[RateLimiter] Redis error in resetRateLimit:', (error as Error).message);
      }
    }
  }

  // Memory fallback
  memoryStore.delete(key);
  return true;
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(rateLimitInfo: RateLimitInfo): RateLimitHeaders {
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
export function getRateLimitConfig(type: RateLimitType = 'default'): RateLimitConfig {
  return rateLimitConfig[type] || rateLimitConfig.default;
}

/**
 * Get rate limiter status (for health checks)
 */
export function getRateLimiterStatus(): RateLimiterStatus {
  return {
    store: isRedisConnected() ? 'redis' : 'memory',
    redisConnected: isRedisConnected(),
    memoryStoreSize: memoryStore.size,
    config: rateLimitConfig,
  };
}

export default rateLimit;
