import { logger } from "../_core/logger";
import { getDb } from "../db";
import {
  feedItems,
  questions,
  answers,
  userTopicPreferences,
  userFollows,
  aiReputation,
} from "../../drizzle/schema";
import { eq, desc, and, gte, lte, inArray } from "drizzle-orm";
import { getCached, setCached, CACHE_PREFIXES, CACHE_TTL } from "./cacheService";

/**
 * Feed Service - Generates personalized feeds with trending, latest, recommended, and following
 */

export interface FeedItemResult {
  id: number;
  questionId: number;
  questionText: string;
  userId: number;
  answerCount: number;
  voteCount: number;
  viewCount: number;
  score: number;
  createdAt: Date;
  feedType: string;
}

/**
 * Calculate trending score
 */
function calculateTrendingScore(question: any): number {
  let score = 0;

  // Recency: newer questions score higher
  const ageHours = (Date.now() - question.createdAt.getTime()) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 100 - ageHours * 2);
  score += recencyScore * 0.3;

  // Engagement: votes and answers
  score += question.voteCount * 5 * 0.3;
  score += question.answerCount * 10 * 0.2;

  // Views
  score += Math.min(question.viewCount / 10, 50) * 0.2;

  return score;
}

/**
 * Calculate recommendation score
 */
function calculateRecommendationScore(
  question: any,
  userTopicScores: Map<number, number>
): number {
  let score = 0;

  // Topic relevance (would need to fetch topics for this question)
  // For now, use a base score
  score += 50;

  // Quality of answers
  score += question.answerCount * 5;

  // Engagement
  score += question.voteCount * 2;

  return score;
}

/**
 * Generate trending feed
 */
export async function generateTrendingFeed(
  userId: number,
  limit: number = 20
): Promise<FeedItemResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check cache
    const cacheKey = `user-${userId}-trending`;
    const cached = await getCached<FeedItemResult[]>(CACHE_PREFIXES.FEED, cacheKey);
    if (cached) {
      logger.debug({ userId }, "Trending feed from cache");
      return cached;
    }

    // Get trending questions from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trendingQuestions = await db
      .select()
      .from(questions)
      .where(and(gte(questions.createdAt, sevenDaysAgo), eq(questions.status, "active")))
      .orderBy(desc(questions.voteCount), desc(questions.answerCount))
      .limit(limit);

    // Score and sort
    const scored = trendingQuestions
      .map((q) => ({
        ...q,
        score: calculateTrendingScore(q),
      }))
      .sort((a, b) => b.score - a.score);

    // Store in feed_items table
    for (const item of scored) {
      await db
        .insert(feedItems)
        .values({
          userId,
          questionId: item.id,
          feedType: "trending",
          score: item.score.toString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        } as any)
        .onDuplicateKeyUpdate({
          set: {
            score: item.score.toString(),
          },
        });
    }

    // Format results
    const results: FeedItemResult[] = scored.map((q) => ({
      id: q.id,
      questionId: q.id,
      questionText: q.text,
      userId: q.userId,
      answerCount: q.answerCount || 0,
      voteCount: q.voteCount || 0,
      viewCount: q.viewCount || 0,
      score: q.score,
      createdAt: q.createdAt,
      feedType: "trending",
    }));

    // Cache results
    await setCached(CACHE_PREFIXES.FEED, cacheKey, results, {
      ttl: CACHE_TTL.FEED,
      tags: [`user-${userId}`],
    });

    logger.info({ userId, count: results.length }, "Trending feed generated");
    return results;
  } catch (error) {
    logger.error({ error, userId }, "Failed to generate trending feed");
    return [];
  }
}

/**
 * Generate latest feed
 */
export async function generateLatestFeed(
  userId: number,
  limit: number = 20
): Promise<FeedItemResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check cache
    const cacheKey = `user-${userId}-latest`;
    const cached = await getCached<FeedItemResult[]>(CACHE_PREFIXES.FEED, cacheKey);
    if (cached) {
      return cached;
    }

    // Get latest active questions
    const latestQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.status, "active"))
      .orderBy(desc(questions.createdAt))
      .limit(limit);

    // Format results
    const results: FeedItemResult[] = latestQuestions.map((q, index) => ({
      id: q.id,
      questionId: q.id,
      questionText: q.text,
      userId: q.userId,
      answerCount: q.answerCount || 0,
      voteCount: q.voteCount || 0,
      viewCount: q.viewCount || 0,
      score: limit - index, // Simple score based on order
      createdAt: q.createdAt,
      feedType: "latest",
    }));

    // Cache results
    await setCached(CACHE_PREFIXES.FEED, cacheKey, results, {
      ttl: CACHE_TTL.FEED,
      tags: [`user-${userId}`],
    });

    logger.info({ userId, count: results.length }, "Latest feed generated");
    return results;
  } catch (error) {
    logger.error({ error, userId }, "Failed to generate latest feed");
    return [];
  }
}

/**
 * Generate recommended feed (based on user preferences)
 */
export async function generateRecommendedFeed(
  userId: number,
  limit: number = 20
): Promise<FeedItemResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check cache
    const cacheKey = `user-${userId}-recommended`;
    const cached = await getCached<FeedItemResult[]>(CACHE_PREFIXES.FEED, cacheKey);
    if (cached) {
      return cached;
    }

    // Get user's topic preferences
    const preferences = await db
      .select()
      .from(userTopicPreferences)
      .where(eq(userTopicPreferences.userId, userId));

    // Get questions matching user preferences
    const recommendedQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.status, "active"))
      .orderBy(desc(questions.voteCount), desc(questions.answerCount))
      .limit(limit * 2); // Get more to filter

    // Score based on user preferences
    const scored = recommendedQuestions
      .map((q) => ({
        ...q,
        score: calculateRecommendationScore(q, new Map()),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Format results
    const results: FeedItemResult[] = scored.map((q) => ({
      id: q.id,
      questionId: q.id,
      questionText: q.text,
      userId: q.userId,
      answerCount: q.answerCount || 0,
      voteCount: q.voteCount || 0,
      viewCount: q.viewCount || 0,
      score: q.score,
      createdAt: q.createdAt,
      feedType: "recommended",
    }));

    // Cache results
    await setCached(CACHE_PREFIXES.FEED, cacheKey, results, {
      ttl: CACHE_TTL.FEED,
      tags: [`user-${userId}`],
    });

    logger.info({ userId, count: results.length }, "Recommended feed generated");
    return results;
  } catch (error) {
    logger.error({ error, userId }, "Failed to generate recommended feed");
    return [];
  }
}

/**
 * Generate following feed (questions from followed users)
 */
export async function generateFollowingFeed(
  userId: number,
  limit: number = 20
): Promise<FeedItemResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check cache
    const cacheKey = `user-${userId}-following`;
    const cached = await getCached<FeedItemResult[]>(CACHE_PREFIXES.FEED, cacheKey);
    if (cached) {
      return cached;
    }

    // Get users that this user follows
    const following = await db
      .select()
      .from(userFollows)
      .where(eq(userFollows.followerId, userId));

    const followingIds = following.map((f) => f.followingId);

    if (followingIds.length === 0) {
      return [];
    }

    // Get questions from followed users
    const followingQuestions = await db
      .select()
      .from(questions)
      .where(and(inArray(questions.userId, followingIds), eq(questions.status, "active")))
      .orderBy(desc(questions.createdAt))
      .limit(limit);

    // Format results
    const results: FeedItemResult[] = followingQuestions.map((q, index) => ({
      id: q.id,
      questionId: q.id,
      questionText: q.text,
      userId: q.userId,
      answerCount: q.answerCount || 0,
      voteCount: q.voteCount || 0,
      viewCount: q.viewCount || 0,
      score: limit - index,
      createdAt: q.createdAt,
      feedType: "following",
    }));

    // Cache results
    await setCached(CACHE_PREFIXES.FEED, cacheKey, results, {
      ttl: CACHE_TTL.FEED,
      tags: [`user-${userId}`],
    });

    logger.info({ userId, count: results.length }, "Following feed generated");
    return results;
  } catch (error) {
    logger.error({ error, userId }, "Failed to generate following feed");
    return [];
  }
}

/**
 * Get combined feed
 */
export async function getCombinedFeed(
  userId: number,
  limit: number = 50
): Promise<FeedItemResult[]> {
  try {
    // Get all feed types
    const [trending, latest, recommended, following] = await Promise.all([
      generateTrendingFeed(userId, limit / 4),
      generateLatestFeed(userId, limit / 4),
      generateRecommendedFeed(userId, limit / 4),
      generateFollowingFeed(userId, limit / 4),
    ]);

    // Combine and deduplicate
    const combined = [...trending, ...latest, ...recommended, ...following];
    const seen = new Set<number>();
    const unique = combined.filter((item) => {
      if (seen.has(item.questionId)) return false;
      seen.add(item.questionId);
      return true;
    });

    // Sort by score
    return unique.sort((a, b) => b.score - a.score).slice(0, limit);
  } catch (error) {
    logger.error({ error, userId }, "Failed to get combined feed");
    return [];
  }
}

export default {
  generateTrendingFeed,
  generateLatestFeed,
  generateRecommendedFeed,
  generateFollowingFeed,
  getCombinedFeed,
};
