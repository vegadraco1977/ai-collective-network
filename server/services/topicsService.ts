import { logger } from "../_core/logger";
import { getDb } from "../db";
import { topics, questionTopics, userTopicPreferences } from "../../drizzle/schema";
import { eq, desc, inArray, and } from "drizzle-orm";

/**
 * Topics Service - Manages topics, categories, and knowledge graph relationships
 */

export interface TopicResult {
  id: number;
  name: string;
  description?: string;
  questionCount: number;
  answerCount: number;
  trendingScore: number;
  popularity: number;
}

/**
 * Create or get topic
 */
export async function createOrGetTopic(
  name: string,
  description?: string,
  parentTopicId?: number
): Promise<TopicResult | null> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check if topic exists
    const existing = await db
      .select()
      .from(topics)
      .where(eq(topics.name, name.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      const t = existing[0];
      return {
        id: t.id,
        name: t.name,
        description: t.description || undefined,
        questionCount: t.questionCount,
        answerCount: t.answerCount,
        trendingScore: parseFloat(String(t.trendingScore || 0)),
        popularity: t.popularity || 0,
      };
    }

    // Create new topic
    const result = await db.insert(topics).values({
      name: name.toLowerCase(),
      description,
      parentTopicId,
      questionCount: 0,
      answerCount: 0,
      trendingScore: "0.00",
      popularity: 0,
    } as any);

    logger.info({ name }, "Topic created");

    // Get the created topic ID (use a simple counter)
    const created = await db
      .select()
      .from(topics)
      .where(eq(topics.name, name.toLowerCase()))
      .limit(1);

    const topicId = created[0]?.id || 0;

    return {
      id: topicId,
      name: name.toLowerCase(),
      description,
      questionCount: 0,
      answerCount: 0,
      trendingScore: 0,
      popularity: 0,
    };
  } catch (error) {
    logger.error({ error, name }, "Failed to create topic");
    return null;
  }
}

/**
 * Get trending topics
 */
export async function getTrendingTopics(limit: number = 10): Promise<TopicResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const trendingTopics = await db
      .select()
      .from(topics)
      .orderBy(desc(topics.trendingScore))
      .limit(limit);

    return trendingTopics.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || undefined,
      questionCount: t.questionCount,
      answerCount: t.answerCount,
      trendingScore: parseFloat(String(t.trendingScore || 0)),
      popularity: t.popularity || 0,
    }));
  } catch (error) {
    logger.error({ error }, "Failed to get trending topics");
    return [];
  }
}

/**
 * Get popular topics
 */
export async function getPopularTopics(limit: number = 10): Promise<TopicResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const popularTopics = await db
      .select()
      .from(topics)
      .orderBy(desc(topics.popularity))
      .limit(limit);

    return popularTopics.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || undefined,
      questionCount: t.questionCount,
      answerCount: t.answerCount,
      trendingScore: parseFloat(String(t.trendingScore || 0)),
      popularity: t.popularity || 0,
    }));
  } catch (error) {
    logger.error({ error }, "Failed to get popular topics");
    return [];
  }
}

/**
 * Link question to topics
 */
export async function linkQuestionToTopics(
  questionId: number,
  topicNames: string[]
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    for (const topicName of topicNames) {
      // Get or create topic
      const topic = await createOrGetTopic(topicName);
      if (!topic) continue;

      // Link question to topic
      await db
        .insert(questionTopics)
        .values({
          questionId,
          topicId: topic.id,
        } as any)
        .onDuplicateKeyUpdate({
          set: {
            questionId,
          },
        });

      // Update topic stats
      await db
        .update(topics)
        .set({
          questionCount: (await db
            .select()
            .from(questionTopics)
            .where(eq(questionTopics.topicId, topic.id))).length,
        } as any)
        .where(eq(topics.id, topic.id));
    }

    logger.info({ questionId, topicCount: topicNames.length }, "Question linked to topics");
    return true;
  } catch (error) {
    logger.error({ error, questionId }, "Failed to link question to topics");
    return false;
  }
}

/**
 * Get topic by name
 */
export async function getTopicByName(name: string): Promise<TopicResult | null> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const result = await db
      .select()
      .from(topics)
      .where(eq(topics.name, name.toLowerCase()))
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    const t = result[0];
    return {
      id: t.id,
      name: t.name,
      description: t.description || undefined,
      questionCount: t.questionCount,
      answerCount: t.answerCount,
      trendingScore: parseFloat(String(t.trendingScore || 0)),
      popularity: t.popularity || 0,
    };
  } catch (error) {
    logger.error({ error, name }, "Failed to get topic");
    return null;
  }
}

/**
 * Update topic trending score
 */
export async function updateTopicTrendingScore(topicId: number, score: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(topics)
      .set({
        trendingScore: score.toString(),
      } as any)
      .where(eq(topics.id, topicId));

    return true;
  } catch (error) {
    logger.error({ error, topicId }, "Failed to update topic trending score");
    return false;
  }
}

/**
 * User follows topic
 */
export async function userFollowsTopic(userId: number, topicId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .insert(userTopicPreferences)
      .values({
        userId,
        topicId,
        isFollowing: true,
        interestScore: "0.50",
      } as any)
      .onDuplicateKeyUpdate({
        set: {
          isFollowing: true,
        },
      });

    logger.info({ userId, topicId }, "User followed topic");
    return true;
  } catch (error) {
    logger.error({ error, userId, topicId }, "Failed to follow topic");
    return false;
  }
}

/**
 * User unfollows topic
 */
export async function userUnfollowsTopic(userId: number, topicId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(userTopicPreferences)
      .set({
        isFollowing: false,
      } as any)
      .where(and(eq(userTopicPreferences.userId, userId), eq(userTopicPreferences.topicId, topicId)));

    logger.info({ userId, topicId }, "User unfollowed topic");
    return true;
  } catch (error) {
    logger.error({ error, userId, topicId }, "Failed to unfollow topic");
    return false;
  }
}

/**
 * Get user's followed topics
 */
export async function getUserFollowedTopics(userId: number): Promise<TopicResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const preferences = await db
      .select()
      .from(userTopicPreferences)
      .where(and(eq(userTopicPreferences.userId, userId), eq(userTopicPreferences.isFollowing, true)));

    const topicIds = preferences.map((p) => p.topicId);
    if (topicIds.length === 0) {
      return [];
    }

    const userTopics = await db
      .select()
      .from(topics)
      .where(inArray(topics.id, topicIds));

    return userTopics.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || undefined,
      questionCount: t.questionCount,
      answerCount: t.answerCount,
      trendingScore: parseFloat(String(t.trendingScore || 0)),
      popularity: t.popularity || 0,
    }));
  } catch (error) {
    logger.error({ error, userId }, "Failed to get user followed topics");
    return [];
  }
}

export default {
  createOrGetTopic,
  getTrendingTopics,
  getPopularTopics,
  linkQuestionToTopics,
  getTopicByName,
  updateTopicTrendingScore,
  userFollowsTopic,
  userUnfollowsTopic,
  getUserFollowedTopics,
};
