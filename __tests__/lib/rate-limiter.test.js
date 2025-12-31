/**
 * Rate Limiter Tests
 * Tests for distributed rate limiting with Redis/memory fallback
 */

// Mock next/server before importing
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, options) => ({ body, status: options?.status || 200 })),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    exception: jest.fn(),
  },
}));

// Mock Redis module before imports
jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn(),
  isRedisConnected: jest.fn(() => false), // Default to memory store
}));

import {
  rateLimit,
  rateLimitAsync,
  getRateLimitInfo,
  resetRateLimit,
  getRateLimitHeaders,
  getRateLimitConfig,
  getRateLimiterStatus,
} from '@/lib/rate-limiter';

import { RateLimitError } from '@/lib/errors';
import { isRedisConnected, getRedis } from '@/lib/redis';

// ============================================================
// Rate Limit Configuration Tests
// ============================================================

describe('getRateLimitConfig', () => {
  test('returns default config', () => {
    const config = getRateLimitConfig('default');
    expect(config).toEqual({ windowMs: 60000, max: 100 });
  });

  test('returns auth config (stricter limits)', () => {
    const config = getRateLimitConfig('auth');
    expect(config).toEqual({ windowMs: 300000, max: 10 });
    expect(config.max).toBeLessThan(getRateLimitConfig('default').max);
  });

  test('returns api config', () => {
    const config = getRateLimitConfig('api');
    expect(config).toEqual({ windowMs: 60000, max: 60 });
  });

  test('returns heavy config (stricter than api)', () => {
    const config = getRateLimitConfig('heavy');
    expect(config).toEqual({ windowMs: 60000, max: 10 });
    expect(config.max).toBeLessThan(getRateLimitConfig('api').max);
  });

  test('returns realtime config (high frequency)', () => {
    const config = getRateLimitConfig('realtime');
    expect(config).toEqual({ windowMs: 1000, max: 20 });
  });

  test('falls back to default for unknown type', () => {
    const config = getRateLimitConfig('unknown');
    expect(config).toEqual(getRateLimitConfig('default'));
  });
});

// ============================================================
// In-Memory Rate Limiting Tests
// ============================================================

describe('rateLimit (memory store)', () => {
  beforeEach(() => {
    // Reset mocks
    isRedisConnected.mockReturnValue(false);

    // Clear any existing rate limits
    // Note: Since we can't access memoryStore directly, we use resetRateLimit
  });

  test('returns rate limit info on first request', () => {
    const identifier = `test-user-${Date.now()}-${Math.random()}`;
    const result = rateLimit(identifier, 'default');

    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('resetTime');
    expect(result).toHaveProperty('store', 'memory');
  });

  test('decrements remaining count with each request', async () => {
    const identifier = `test-decrement-${Date.now()}-${Math.random()}`;

    const first = rateLimit(identifier, 'default');
    const second = rateLimit(identifier, 'default');

    expect(second.remaining).toBe(first.remaining - 1);
  });

  test('throws RateLimitError when limit exceeded', () => {
    const identifier = `test-exceed-${Date.now()}-${Math.random()}`;
    const config = getRateLimitConfig('heavy'); // 10 requests per minute

    // Make requests up to the limit
    for (let i = 0; i < config.max; i++) {
      rateLimit(identifier, 'heavy');
    }

    // Next request should throw
    expect(() => rateLimit(identifier, 'heavy')).toThrow(RateLimitError);
  });

  test('RateLimitError includes retry-after value', () => {
    const identifier = `test-retry-${Date.now()}-${Math.random()}`;
    const config = getRateLimitConfig('heavy');

    // Exhaust limit
    for (let i = 0; i < config.max; i++) {
      rateLimit(identifier, 'heavy');
    }

    try {
      rateLimit(identifier, 'heavy');
      fail('Should have thrown RateLimitError');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.retryAfter).toBeGreaterThan(0);
      expect(error.retryAfter).toBeLessThanOrEqual(60);
    }
  });

  test('uses correct config for each type', () => {
    const identifier = `test-config-${Date.now()}-${Math.random()}`;

    const apiResult = rateLimit(identifier, 'api');
    expect(apiResult.limit).toBe(60);

    const authIdentifier = `test-auth-${Date.now()}-${Math.random()}`;
    const authResult = rateLimit(authIdentifier, 'auth');
    expect(authResult.limit).toBe(10);
  });
});

// ============================================================
// Async Rate Limiting Tests
// ============================================================

describe('rateLimitAsync (memory store)', () => {
  beforeEach(() => {
    isRedisConnected.mockReturnValue(false);
  });

  test('returns promise with rate limit info', async () => {
    const identifier = `test-async-${Date.now()}-${Math.random()}`;
    const result = await rateLimitAsync(identifier, 'default');

    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('store', 'memory');
  });

  test('throws RateLimitError when exceeded', async () => {
    const identifier = `test-async-exceed-${Date.now()}-${Math.random()}`;

    // Exhaust limit
    for (let i = 0; i < 10; i++) {
      await rateLimitAsync(identifier, 'heavy');
    }

    await expect(rateLimitAsync(identifier, 'heavy')).rejects.toThrow(RateLimitError);
  });
});

// ============================================================
// Rate Limit Info Tests
// ============================================================

describe('getRateLimitInfo', () => {
  beforeEach(() => {
    isRedisConnected.mockReturnValue(false);
  });

  test('returns info without incrementing counter', async () => {
    const identifier = `test-info-${Date.now()}-${Math.random()}`;

    // Make some requests
    rateLimit(identifier, 'default');
    rateLimit(identifier, 'default');

    const info1 = await getRateLimitInfo(identifier, 'default');
    const info2 = await getRateLimitInfo(identifier, 'default');

    // Should be the same (not incremented)
    expect(info1.used).toBe(info2.used);
    expect(info1.remaining).toBe(info2.remaining);
  });

  test('returns correct used count', async () => {
    const identifier = `test-used-${Date.now()}-${Math.random()}`;

    rateLimit(identifier, 'api');
    rateLimit(identifier, 'api');
    rateLimit(identifier, 'api');

    const info = await getRateLimitInfo(identifier, 'api');
    expect(info.used).toBe(3);
    expect(info.remaining).toBe(57); // 60 - 3
  });

  test('returns full limit for new identifier', async () => {
    const identifier = `test-new-${Date.now()}-${Math.random()}`;

    const info = await getRateLimitInfo(identifier, 'default');
    expect(info.used).toBe(0);
    expect(info.remaining).toBe(100);
  });
});

// ============================================================
// Rate Limit Reset Tests
// ============================================================

describe('resetRateLimit', () => {
  beforeEach(() => {
    isRedisConnected.mockReturnValue(false);
  });

  test('resets rate limit for identifier', async () => {
    const identifier = `test-reset-${Date.now()}-${Math.random()}`;

    // Use up some requests
    for (let i = 0; i < 5; i++) {
      rateLimit(identifier, 'heavy');
    }

    const infoBefore = await getRateLimitInfo(identifier, 'heavy');
    expect(infoBefore.used).toBe(5);

    // Reset
    await resetRateLimit(identifier, 'heavy');

    const infoAfter = await getRateLimitInfo(identifier, 'heavy');
    expect(infoAfter.used).toBe(0);
  });

  test('returns true on successful reset', async () => {
    const identifier = `test-reset-return-${Date.now()}-${Math.random()}`;
    const result = await resetRateLimit(identifier, 'default');
    expect(result).toBe(true);
  });
});

// ============================================================
// Rate Limit Headers Tests
// ============================================================

describe('getRateLimitHeaders', () => {
  test('returns correct header format', () => {
    const info = {
      limit: 100,
      remaining: 95,
      resetTime: Date.now() + 60000,
      store: 'memory',
    };

    const headers = getRateLimitHeaders(info);

    expect(headers['X-RateLimit-Limit']).toBe('100');
    expect(headers['X-RateLimit-Remaining']).toBe('95');
    expect(headers['X-RateLimit-Store']).toBe('memory');
    expect(headers).toHaveProperty('X-RateLimit-Reset');
  });

  test('reset time is in seconds (unix timestamp)', () => {
    const resetTime = Date.now() + 60000;
    const info = {
      limit: 100,
      remaining: 50,
      resetTime,
      store: 'memory',
    };

    const headers = getRateLimitHeaders(info);
    const resetSeconds = parseInt(headers['X-RateLimit-Reset'], 10);

    // Should be close to expected unix timestamp
    expect(resetSeconds).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(resetSeconds).toBeLessThanOrEqual(Math.ceil((Date.now() + 60000) / 1000));
  });
});

// ============================================================
// Rate Limiter Status Tests
// ============================================================

describe('getRateLimiterStatus', () => {
  test('returns status with memory store when Redis disconnected', () => {
    isRedisConnected.mockReturnValue(false);

    const status = getRateLimiterStatus();

    expect(status.store).toBe('memory');
    expect(status.redisConnected).toBe(false);
    expect(status).toHaveProperty('memoryStoreSize');
    expect(status).toHaveProperty('config');
  });

  test('returns status with redis store when connected', () => {
    isRedisConnected.mockReturnValue(true);

    const status = getRateLimiterStatus();

    expect(status.store).toBe('redis');
    expect(status.redisConnected).toBe(true);
  });

  test('includes all config types', () => {
    const status = getRateLimiterStatus();

    expect(status.config).toHaveProperty('default');
    expect(status.config).toHaveProperty('auth');
    expect(status.config).toHaveProperty('api');
    expect(status.config).toHaveProperty('heavy');
    expect(status.config).toHaveProperty('realtime');
  });
});

// ============================================================
// Security: Rate Limit Attack Prevention Tests
// ============================================================

describe('Rate Limit Security', () => {
  beforeEach(() => {
    isRedisConnected.mockReturnValue(false);
  });

  test('auth type has strictest limits for brute force prevention', () => {
    const authConfig = getRateLimitConfig('auth');
    const apiConfig = getRateLimitConfig('api');
    const defaultConfig = getRateLimitConfig('default');

    // Auth should be most restrictive
    expect(authConfig.max).toBeLessThan(apiConfig.max);
    expect(authConfig.max).toBeLessThan(defaultConfig.max);

    // Auth window should be longer (5 min vs 1 min)
    expect(authConfig.windowMs).toBeGreaterThan(apiConfig.windowMs);
  });

  test('different identifiers have independent limits', () => {
    const user1 = `user1-${Date.now()}-${Math.random()}`;
    const user2 = `user2-${Date.now()}-${Math.random()}`;

    // Exhaust user1's limit
    for (let i = 0; i < 10; i++) {
      rateLimit(user1, 'heavy');
    }

    // User2 should still have full limit
    const result = rateLimit(user2, 'heavy');
    expect(result.remaining).toBe(9); // 10 - 1

    // User1 should be blocked
    expect(() => rateLimit(user1, 'heavy')).toThrow(RateLimitError);
  });

  test('heavy operations have lower limits than regular API', () => {
    const heavyConfig = getRateLimitConfig('heavy');
    const apiConfig = getRateLimitConfig('api');

    expect(heavyConfig.max).toBeLessThan(apiConfig.max);
  });
});
