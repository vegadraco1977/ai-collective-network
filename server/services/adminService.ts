import { logger } from "../_core/logger";
import { getDb } from "../db";
import {
  aiModels,
  users,
  questions,
  answers,
  aiReputation,
  contentModerations,
} from "../../drizzle/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

/**
 * Admin Service - System management and moderation
 */

export interface AIModelConfig {
  id?: number;
  name: string;
  provider: string;
  apiKey?: string;
  endpoint: string;
  priority: number;
  isActive: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ContentModerationAction {
  contentId: number;
  contentType: "question" | "answer";
  action: "approve" | "reject" | "review";
  reason?: string;
  moderatorId: number;
}

export interface SystemStats {
  totalUsers: number;
  totalQuestions: number;
  totalAnswers: number;
  activeModels: number;
  averageResponseTime: number;
  systemHealth: number;
}

/**
 * Create or update AI model
 */
export async function createOrUpdateAIModel(config: AIModelConfig): Promise<AIModelConfig | null> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    if (config.id) {
      // Update existing
      await db
        .update(aiModels)
        .set({
          name: config.name,
          provider: config.provider,
          endpoint: config.endpoint,
          priority: config.priority,
          isActive: config.isActive,
          maxTokens: config.maxTokens,
          temperature: config.temperature?.toString(),
        } as any)
        .where(eq(aiModels.id, config.id));

      logger.info({ modelId: config.id }, "AI model updated");
    } else {
      // Create new
      await db.insert(aiModels).values({
        name: config.name,
        provider: config.provider,
        endpoint: config.endpoint,
        priority: config.priority,
        isActive: config.isActive,
        maxTokens: config.maxTokens,
        temperature: config.temperature?.toString(),
      } as any);

      logger.info({ name: config.name }, "AI model created");
    }

    return config;
  } catch (error) {
    logger.error({ error }, "Failed to create/update AI model");
    return null;
  }
}

/**
 * Get all AI models
 */
export async function getAllAIModels(): Promise<AIModelConfig[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const models = await db.select().from(aiModels).orderBy(desc(aiModels.priority));

    return models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      endpoint: m.endpoint,
      priority: m.priority,
      isActive: m.isActive,
      maxTokens: m.maxTokens || undefined,
      temperature: m.temperature ? parseFloat(m.temperature) : undefined,
    }));
  } catch (error) {
    logger.error({ error }, "Failed to get AI models");
    return [];
  }
}

/**
 * Moderate content
 */
export async function moderateContent(action: ContentModerationAction): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Record moderation action
    await db.insert(contentModerations).values({
      contentId: action.contentId,
      contentType: action.contentType,
      action: action.action,
      reason: action.reason,
      moderatorId: action.moderatorId,
    } as any);

    // Update content status
    if (action.contentType === "question") {
      const status = action.action === "approve" ? "active" : action.action === "reject" ? "rejected" : "review";
      await db
        .update(questions)
        .set({
          status,
        } as any)
        .where(eq(questions.id, action.contentId));
    } else if (action.contentType === "answer") {
      const status = action.action === "approve" ? "active" : action.action === "reject" ? "rejected" : "review";
      await db
        .update(answers)
        .set({
          status,
        } as any)
        .where(eq(answers.id, action.contentId));
    }

    logger.info({ action }, "Content moderated");
    return true;
  } catch (error) {
    logger.error({ error }, "Failed to moderate content");
    return false;
  }
}

/**
 * Get system statistics
 */
export async function getSystemStats(): Promise<SystemStats> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Count users
    const userCount = await db.select().from(users);

    // Count questions
    const questionCount = await db.select().from(questions);

    // Count answers
    const answerCount = await db.select().from(answers);

    // Count active models
    const activeModels = await db.select().from(aiModels).where(eq(aiModels.isActive, true));

    // Calculate average response time
    const allAnswers = await db.select().from(answers);
    const avgResponseTime =
      allAnswers.length > 0
        ? allAnswers.reduce((sum, a) => sum + (a.latency || 0), 0) / allAnswers.length
        : 0;

    // Calculate system health (0-100)
    let health = 100;
    if (activeModels.length === 0) health -= 20;
    if (avgResponseTime > 5000) health -= 15; // > 5s
    if (questionCount.length === 0) health -= 10;

    return {
      totalUsers: userCount.length,
      totalQuestions: questionCount.length,
      totalAnswers: answerCount.length,
      activeModels: activeModels.length,
      averageResponseTime: Math.round(avgResponseTime),
      systemHealth: Math.max(0, health),
    };
  } catch (error) {
    logger.error({ error }, "Failed to get system stats");
    return {
      totalUsers: 0,
      totalQuestions: 0,
      totalAnswers: 0,
      activeModels: 0,
      averageResponseTime: 0,
      systemHealth: 0,
    };
  }
}

/**
 * Get content pending moderation
 */
export async function getPendingModeration(
  limit: number = 20
): Promise<Array<{ id: number; type: string; content: string; createdAt: Date }>> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get pending questions
    const pendingQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.status, "review"))
      .orderBy(desc(questions.createdAt))
      .limit(limit / 2);

    // Get pending answers
    const pendingAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.status, "review"))
      .orderBy(desc(answers.createdAt))
      .limit(limit / 2);

    const combined = [
      ...pendingQuestions.map((q) => ({
        id: q.id,
        type: "question",
        content: q.text,
        createdAt: q.createdAt,
      })),
      ...pendingAnswers.map((a) => ({
        id: a.id,
        type: "answer",
        content: a.content,
        createdAt: a.createdAt,
      })),
    ];

    return combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    logger.error({ error }, "Failed to get pending moderation");
    return [];
  }
}

/**
 * Ban user
 */
export async function banUser(userId: number, reason?: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(users)
      .set({
        role: "banned",
      } as any)
      .where(eq(users.id, userId));

    logger.warn({ userId, reason }, "User banned");
    return true;
  } catch (error) {
    logger.error({ error, userId }, "Failed to ban user");
    return false;
  }
}

/**
 * Get user details
 */
export async function getUserDetails(userId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user || user.length === 0) {
      return null;
    }

    const u = user[0];
    const userQuestions = await db.select().from(questions).where(eq(questions.userId, userId));
    const userAnswers = await db.select().from(answers).where(eq(answers.aiModelId, userId));

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      questionCount: userQuestions.length,
      answerCount: userAnswers.length,
      bio: u.bio,
      avatar: u.avatar,
    };
  } catch (error) {
    logger.error({ error, userId }, "Failed to get user details");
    return null;
  }
}

export default {
  createOrUpdateAIModel,
  getAllAIModels,
  moderateContent,
  getSystemStats,
  getPendingModeration,
  banUser,
  getUserDetails,
};
