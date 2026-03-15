import Redis from "ioredis";
import { logger } from "../_core/logger";

/**
 * Cache Service - Redis-backed caching layer
 * Handles question responses, synthesis, reputation, and feed caching
 */

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableReadyCheck: false,
  enableOfflineQueue: true,
});

redis.on("error", (err) => {
  logger.error({ error: err.message }, "Redis connection error");
});

redis.on("connect", () => {
  logger.info("Redis connected successfully");
});

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for invalidation
}

/**
 * Generate cache key with prefix
 */
function generateKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}

/**
 * Get value from cache
 */
export async function getCached<T>(
  prefix: string,
  identifier: string
): Promise<T | null> {
  try {
    const key = generateKey(prefix, identifier);
    const value = await redis.get(key);

    if (value) {
      logger.debug({ key }, "Cache hit");
      return JSON.parse(value) as T;
    }

    logger.debug({ key }, "Cache miss");
    return null;
  } catch (error) {
    logger.error({ error, prefix, identifier }, "Cache get error");
    return null;
  }
}

/**
 * Set value in cache
 */
export async function setCached<T>(
  prefix: string,
  identifier: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> {
  try {
    const key = generateKey(prefix, identifier);
    const ttl = options.ttl || 86400; // Default 1 day

    const result = await redis.setex(key, ttl, JSON.stringify(value));

    // Set tags for invalidation
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        await redis.sadd(`tag:${tag}`, key);
      }
    }

    logger.debug({ key, ttl }, "Cache set");
    return result === "OK";
  } catch (error) {
    logger.error({ error, prefix, identifier }, "Cache set error");
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function deleteCached(prefix: string, identifier: string): Promise<boolean> {
  try {
    const key = generateKey(prefix, identifier);
    const result = await redis.del(key);
    logger.debug({ key }, "Cache deleted");
    return result > 0;
  } catch (error) {
    logger.error({ error, prefix, identifier }, "Cache delete error");
    return false;
  }
}

/**
 * Invalidate cache by tag
 */
export async function invalidateByTag(tag: string): Promise<number> {
  try {
    const keys = await redis.smembers(`tag:${tag}`);
    if (keys.length === 0) return 0;

    const result = await redis.del(...keys);
    await redis.del(`tag:${tag}`);

    logger.info({ tag, count: result }, "Cache invalidated by tag");
    return result;
  } catch (error) {
    logger.error({ error, tag }, "Cache invalidation error");
    return 0;
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<boolean> {
  try {
    await redis.flushdb();
    logger.info("All cache cleared");
    return true;
  } catch (error) {
    logger.error({ error }, "Cache clear error");
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const info = await redis.info("memory");
    const dbSize = await redis.dbsize();

    return {
      dbSize,
      info,
    };
  } catch (error) {
    logger.error({ error }, "Cache stats error");
    return null;
  }
}

/**
 * Cache key prefixes
 */
export const CACHE_PREFIXES = {
  QUESTION: "question",
  RESPONSE: "response",
  SYNTHESIS: "synthesis",
  REPUTATION: "reputation",
  FEED: "feed",
  TRENDING: "trending",
  VECTOR: "vector",
  LOCK: "lock",
} as const;

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  RESPONSE: 7 * 24 * 60 * 60, // 7 days
  SYNTHESIS: 30 * 24 * 60 * 60, // 30 days
  REPUTATION: 24 * 60 * 60, // 1 day
  FEED: 60 * 60, // 1 hour
  TRENDING: 60 * 60, // 1 hour
  VECTOR: 7 * 24 * 60 * 60, // 7 days
  LOCK: 5 * 60, // 5 minutes
} as const;

export default redis;
