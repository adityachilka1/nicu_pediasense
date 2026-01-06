/**
 * Redis client configuration
 * Provides a singleton Redis connection with automatic reconnection
 * Falls back gracefully if Redis is unavailable
 */

import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

// Redis connection status
let redisClient: Redis | null = null;
let isRedisAvailable = false;
let connectionAttempted = false;

// Redis configuration type
interface RedisConfig extends RedisOptions {
  keyPrefix?: string;
}

/**
 * Get Redis configuration from environment variables
 */
function getRedisConfig(): string | RedisConfig {
  // Support both REDIS_URL (connection string) and individual params
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'nicu:',
    // Connection options
    maxRetriesPerRequest: 3,
    retryStrategy(times: number): number {
      // Exponential backoff with max 30 seconds
      const delay = Math.min(times * 100, 30000);
      return delay;
    },
    // Reconnect on error
    reconnectOnError(err: Error): boolean {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  };
}

/**
 * Create and configure Redis client
 */
function createRedisClient(): Redis {
  const config = getRedisConfig();

  const client = typeof config === 'string'
    ? new Redis(config, { keyPrefix: 'nicu:', maxRetriesPerRequest: 3 })
    : new Redis(config);

  // Event handlers
  client.on('connect', () => {
    console.log('[Redis] Connected successfully');
    isRedisAvailable = true;
  });

  client.on('ready', () => {
    console.log('[Redis] Ready to accept commands');
    isRedisAvailable = true;
  });

  client.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
    isRedisAvailable = false;
  });

  client.on('close', () => {
    console.log('[Redis] Connection closed');
    isRedisAvailable = false;
  });

  client.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...');
  });

  return client;
}

/**
 * Get Redis client singleton
 * Returns null if Redis is not configured or unavailable
 */
export function getRedis(): Redis | null {
  // Skip Redis in test environment unless explicitly enabled
  if (process.env.NODE_ENV === 'test' && !process.env.REDIS_TEST_ENABLED) {
    return null;
  }

  // Check if Redis is disabled via environment
  if (process.env.REDIS_DISABLED === 'true') {
    return null;
  }

  // Only attempt connection once
  if (!connectionAttempted) {
    connectionAttempted = true;

    // Only create client if Redis URL or host is configured
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      try {
        redisClient = createRedisClient();
      } catch (error) {
        console.error('[Redis] Failed to create client:', (error as Error).message);
        redisClient = null;
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('[Redis] No Redis configuration found. Using in-memory fallback (not recommended for production).');
    }
  }

  return redisClient;
}

/**
 * Check if Redis is available and connected
 */
export function isRedisConnected(): boolean {
  return isRedisAvailable && redisClient?.status === 'ready';
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isRedisAvailable = false;
    connectionAttempted = false;
  }
}

// Type for Redis command names
type RedisCommandName = keyof Redis;

/**
 * Execute a Redis command with fallback
 * Returns null if Redis is unavailable
 */
export async function redisCommand<T = unknown>(
  command: RedisCommandName,
  ...args: unknown[]
): Promise<T | null> {
  const client = getRedis();
  if (!client || !isRedisConnected()) {
    return null;
  }

  try {
    const fn = client[command] as ((...args: unknown[]) => Promise<T>) | undefined;
    if (typeof fn === 'function') {
      return await fn.apply(client, args);
    }
    return null;
  } catch (error) {
    console.error(`[Redis] Command ${String(command)} failed:`, (error as Error).message);
    return null;
  }
}

export default getRedis;
