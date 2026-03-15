import { logger } from "../_core/logger";
import { getDb } from "../db";
import {
  aiReputation,
  aiReputationHistory,
  aiModelAchievements,
  validations,
  answers,
} from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { setCached, CACHE_PREFIXES, CACHE_TTL } from "./cacheService";

/**
 * Reputation Service - Tracks and calculates AI model reputation metrics
 */

export interface ReputationMetrics {
  aiModelId: number;
  totalResponses: number;
  averageRating: number;
  correctCount: number;
  incorrectCount: number;
  totalVotes: number;
  reputationScore: number;
  accuracyRate: number;
  averageResponseTime: number;
  consistencyScore: number;
  trustScore: number;
}

export interface Achievement {
  badge: string;
  title: string;
  description: string;
}

const ACHIEVEMENTS = {
  FIRST_RESPONSE: {
    badge: "first-response",
    title: "First Response",
    description: "Provided the first response to a question",
  },
  ACCURACY_MASTER: {
    badge: "accuracy-master",
    title: "Accuracy Master",
    description: "Achieved 90%+ accuracy rate",
  },
  SPEED_DEMON: {
    badge: "speed-demon",
    title: "Speed Demon",
    description: "Average response time under 2 seconds",
  },
  CONSISTENCY_EXPERT: {
    badge: "consistency-expert",
    title: "Consistency Expert",
    description: "Maintained 85%+ consistency score",
  },
  REPUTATION_STAR: {
    badge: "reputation-star",
    title: "Reputation Star",
    description: "Achieved 80+ reputation score",
  },
  TRUSTED_ADVISOR: {
    badge: "trusted-advisor",
    title: "Trusted Advisor",
    description: "Achieved 90+ trust score",
  },
} as const;

/**
 * Update reputation for a model
 */
export async function updateReputation(aiModelId: number): Promise<ReputationMetrics | null> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get all answers from this model
    const modelAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.aiModelId, aiModelId));

    if (modelAnswers.length === 0) {
      logger.warn({ aiModelId }, "No answers found for reputation update");
      return null;
    }

    // Get validations for these answers
    const answerIds = modelAnswers.map((a) => a.id);
    const modelValidations = await db
      .select()
      .from(validations)
      .where(inArray(validations.answerId, answerIds));

    // Calculate metrics
    const totalResponses = modelAnswers.length;
    const totalVotes = modelValidations.length;

    const correctCount = modelValidations.filter((v) => v.isCorrect === true).length;
    const incorrectCount = modelValidations.filter((v) => v.isCorrect === false).length;

    const averageRating =
      totalVotes > 0
        ? modelValidations.reduce((sum, v) => sum + (v.rating || 0), 0) / totalVotes
        : 0;

    const accuracyRate = totalVotes > 0 ? correctCount / totalVotes : 0;

    const averageResponseTime =
      totalResponses > 0
        ? modelAnswers.reduce((sum, a) => sum + (a.latency || 0), 0) / totalResponses
        : 0;

    // Calculate consistency score (variance in ratings)
    const consistencyScore = calculateConsistencyScore(
      modelValidations.map((v) => v.rating || 0)
    );

    // Calculate reputation score (weighted combination)
    const reputationScore = calculateReputationScore({
      accuracyRate,
      averageRating,
      consistencyScore,
      totalResponses,
    });

    // Calculate trust score
    const trustScore = calculateTrustScore({
      accuracyRate,
      consistencyScore,
      totalVotes,
    });

    // Update or create reputation record
    const existing = await db
      .select()
      .from(aiReputation)
      .where(eq(aiReputation.aiModelId, aiModelId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(aiReputation)
        .set({
          totalResponses,
          averageRating: averageRating.toString(),
          correctCount,
          incorrectCount,
          totalVotes,
          reputationScore: reputationScore.toString(),
          accuracyRate: accuracyRate.toString(),
          averageResponseTime: Math.round(averageResponseTime),
          consistencyScore: consistencyScore.toString(),
          trustScore: trustScore.toString(),
        } as any)
        .where(eq(aiReputation.aiModelId, aiModelId));
    } else {
      await db.insert(aiReputation).values({
        aiModelId,
        totalResponses,
        averageRating: averageRating.toString(),
        correctCount,
        incorrectCount,
        totalVotes,
        reputationScore: reputationScore.toString(),
        accuracyRate: accuracyRate.toString(),
        averageResponseTime: Math.round(averageResponseTime),
        consistencyScore: consistencyScore.toString(),
        trustScore: trustScore.toString(),
      } as any);
    }

    // Record history
    await db.insert(aiReputationHistory).values({
      aiModelId,
      reputationScore: reputationScore.toString(),
      accuracyRate: accuracyRate.toString(),
      averageResponseTime: Math.round(averageResponseTime),
      consistencyScore: consistencyScore.toString(),
    } as any);

    // Check and award achievements
    await checkAndAwardAchievements(db, aiModelId, {
      accuracyRate,
      averageResponseTime,
      consistencyScore,
      reputationScore,
      trustScore,
    });

    // Cache metrics
    const metrics: ReputationMetrics = {
      aiModelId,
      totalResponses,
      averageRating,
      correctCount,
      incorrectCount,
      totalVotes,
      reputationScore,
      accuracyRate,
      averageResponseTime: Math.round(averageResponseTime),
      consistencyScore,
      trustScore,
    };

    await setCached(
      CACHE_PREFIXES.REPUTATION,
      `model-${aiModelId}`,
      metrics,
      {
        ttl: CACHE_TTL.REPUTATION,
        tags: [`model-${aiModelId}`],
      }
    );

    logger.info({ aiModelId, reputationScore }, "Reputation updated");

    return metrics;
  } catch (error) {
    logger.error({ error, aiModelId }, "Failed to update reputation");
    return null;
  }
}

/**
 * Calculate consistency score based on rating variance
 */
function calculateConsistencyScore(ratings: number[]): number {
  if (ratings.length < 2) return 0.5;

  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance = ratings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratings.length;
  const stdDev = Math.sqrt(variance);

  // Lower std dev = higher consistency
  // Convert to 0-1 scale
  return Math.max(0, 1 - stdDev / 5);
}

/**
 * Calculate reputation score (weighted combination)
 */
function calculateReputationScore(metrics: {
  accuracyRate: number;
  averageRating: number;
  consistencyScore: number;
  totalResponses: number;
}): number {
  let score = 0;

  // Accuracy: 40% weight
  score += metrics.accuracyRate * 0.4 * 100;

  // Average rating: 30% weight
  score += (metrics.averageRating / 5) * 0.3 * 100;

  // Consistency: 20% weight
  score += metrics.consistencyScore * 0.2 * 100;

  // Response volume bonus: 10% weight (more responses = more data)
  const volumeBonus = Math.min(metrics.totalResponses / 100, 1) * 0.1 * 100;
  score += volumeBonus;

  return Math.min(score, 100);
}

/**
 * Calculate trust score
 */
function calculateTrustScore(metrics: {
  accuracyRate: number;
  consistencyScore: number;
  totalVotes: number;
}): number {
  let score = 0;

  // Accuracy: 50% weight
  score += metrics.accuracyRate * 0.5 * 100;

  // Consistency: 40% weight
  score += metrics.consistencyScore * 0.4 * 100;

  // Sample size bonus: 10% weight
  const sampleBonus = Math.min(metrics.totalVotes / 50, 1) * 0.1 * 100;
  score += sampleBonus;

  return Math.min(score, 100);
}

/**
 * Check and award achievements
 */
async function checkAndAwardAchievements(
  db: any,
  aiModelId: number,
  metrics: {
    accuracyRate: number;
    averageResponseTime: number;
    consistencyScore: number;
    reputationScore: number;
    trustScore: number;
  }
): Promise<void> {
  try {
    const existingAchievements = await db
      .select()
      .from(aiModelAchievements)
      .where(eq(aiModelAchievements.aiModelId, aiModelId));

    const existingBadges = new Set(existingAchievements.map((a: any) => a.badge));

    // Check each achievement
    if (metrics.accuracyRate >= 0.9 && !existingBadges.has("accuracy-master")) {
      await db.insert(aiModelAchievements).values({
        aiModelId,
        badge: ACHIEVEMENTS.ACCURACY_MASTER.badge,
        title: ACHIEVEMENTS.ACCURACY_MASTER.title,
        description: ACHIEVEMENTS.ACCURACY_MASTER.description,
      } as any);
      logger.info({ aiModelId }, "Accuracy Master achievement unlocked");
    }

    if (metrics.averageResponseTime < 2000 && !existingBadges.has("speed-demon")) {
      await db.insert(aiModelAchievements).values({
        aiModelId,
        badge: ACHIEVEMENTS.SPEED_DEMON.badge,
        title: ACHIEVEMENTS.SPEED_DEMON.title,
        description: ACHIEVEMENTS.SPEED_DEMON.description,
      } as any);
      logger.info({ aiModelId }, "Speed Demon achievement unlocked");
    }

    if (metrics.consistencyScore >= 0.85 && !existingBadges.has("consistency-expert")) {
      await db.insert(aiModelAchievements).values({
        aiModelId,
        badge: ACHIEVEMENTS.CONSISTENCY_EXPERT.badge,
        title: ACHIEVEMENTS.CONSISTENCY_EXPERT.title,
        description: ACHIEVEMENTS.CONSISTENCY_EXPERT.description,
      } as any);
      logger.info({ aiModelId }, "Consistency Expert achievement unlocked");
    }

    if (metrics.reputationScore >= 80 && !existingBadges.has("reputation-star")) {
      await db.insert(aiModelAchievements).values({
        aiModelId,
        badge: ACHIEVEMENTS.REPUTATION_STAR.badge,
        title: ACHIEVEMENTS.REPUTATION_STAR.title,
        description: ACHIEVEMENTS.REPUTATION_STAR.description,
      } as any);
      logger.info({ aiModelId }, "Reputation Star achievement unlocked");
    }

    if (metrics.trustScore >= 90 && !existingBadges.has("trusted-advisor")) {
      await db.insert(aiModelAchievements).values({
        aiModelId,
        badge: ACHIEVEMENTS.TRUSTED_ADVISOR.badge,
        title: ACHIEVEMENTS.TRUSTED_ADVISOR.title,
        description: ACHIEVEMENTS.TRUSTED_ADVISOR.description,
      } as any);
      logger.info({ aiModelId }, "Trusted Advisor achievement unlocked");
    }
  } catch (error) {
    logger.error({ error, aiModelId }, "Failed to award achievements");
  }
}

/**
 * Get reputation metrics
 */
export async function getReputation(aiModelId: number): Promise<ReputationMetrics | null> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rep = await db
      .select()
      .from(aiReputation)
      .where(eq(aiReputation.aiModelId, aiModelId))
      .limit(1);

    if (!rep || rep.length === 0) {
      return null;
    }

    const r = rep[0];
    return {
      aiModelId,
      totalResponses: r.totalResponses,
      averageRating: parseFloat(String(r.averageRating || 0)),
      correctCount: r.correctCount,
      incorrectCount: r.incorrectCount,
      totalVotes: r.totalVotes,
      reputationScore: parseFloat(String(r.reputationScore || 0)),
      accuracyRate: parseFloat(String(r.accuracyRate || 0)),
      averageResponseTime: r.averageResponseTime || 0,
      consistencyScore: parseFloat(String(r.consistencyScore || 0)),
      trustScore: parseFloat(String(r.trustScore || 0)),
    };
  } catch (error) {
    logger.error({ error, aiModelId }, "Failed to get reputation");
    return null;
  }
}

export default {
  updateReputation,
  getReputation,
};
