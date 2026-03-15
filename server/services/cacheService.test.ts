import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCached,
  setCached,
  deleteCached,
  invalidateByTag,
  CACHE_PREFIXES,
  CACHE_TTL,
} from "./cacheService";

describe("Cache Service", () => {
  beforeEach(async () => {
    // Clear cache before each test
    vi.clearAllMocks();
  });

  it("should set and get cached value", async () => {
    const testData = { id: 1, name: "Test Question" };
    const key = "test-key";

    // Set cache
    const setResult = await setCached(
      CACHE_PREFIXES.QUESTION,
      key,
      testData,
      { ttl: 3600 }
    );
    expect(setResult).toBe(true);

    // Get cache
    const cachedData = await getCached(CACHE_PREFIXES.QUESTION, key);
    expect(cachedData).toEqual(testData);
  });

  it("should return null for non-existent cache key", async () => {
    const cachedData = await getCached(CACHE_PREFIXES.QUESTION, "non-existent");
    expect(cachedData).toBeNull();
  });

  it("should delete cached value", async () => {
    const testData = { id: 1, name: "Test" };
    const key = "test-delete";

    // Set cache
    await setCached(CACHE_PREFIXES.QUESTION, key, testData);

    // Delete cache
    const deleteResult = await deleteCached(CACHE_PREFIXES.QUESTION, key);
    expect(deleteResult).toBe(true);

    // Verify it's deleted
    const cachedData = await getCached(CACHE_PREFIXES.QUESTION, key);
    expect(cachedData).toBeNull();
  });

  it("should use correct TTL values", () => {
    expect(CACHE_TTL.RESPONSE).toBe(7 * 24 * 60 * 60); // 7 days
    expect(CACHE_TTL.SYNTHESIS).toBe(30 * 24 * 60 * 60); // 30 days
    expect(CACHE_TTL.REPUTATION).toBe(24 * 60 * 60); // 1 day
    expect(CACHE_TTL.FEED).toBe(60 * 60); // 1 hour
    expect(CACHE_TTL.TRENDING).toBe(60 * 60); // 1 hour
  });

  it("should have correct cache prefixes", () => {
    expect(CACHE_PREFIXES.QUESTION).toBe("question");
    expect(CACHE_PREFIXES.RESPONSE).toBe("response");
    expect(CACHE_PREFIXES.SYNTHESIS).toBe("synthesis");
    expect(CACHE_PREFIXES.REPUTATION).toBe("reputation");
    expect(CACHE_PREFIXES.FEED).toBe("feed");
  });

  it("should handle complex objects", async () => {
    const complexData = {
      responses: [
        { modelId: 1, content: "Response 1", score: 0.95 },
        { modelId: 2, content: "Response 2", score: 0.87 },
      ],
      metadata: {
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
    };

    const key = "complex-test";
    await setCached(CACHE_PREFIXES.RESPONSE, key, complexData);

    const cached = await getCached(CACHE_PREFIXES.RESPONSE, key);
    expect(cached).toEqual(complexData);
  });
});
