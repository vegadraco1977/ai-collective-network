import { logger } from "../_core/logger";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * Notification Service - Manages user notifications
 */

export type NotificationType =
  | "new_response"
  | "synthesis_complete"
  | "reputation_gained"
  | "achievement_unlocked"
  | "trending_question"
  | "follow"
  | "admin_message";

export interface NotificationData {
  userId: number;
  type: NotificationType;
  title: string;
  content: string;
  relatedQuestionId?: number;
  relatedAnswerId?: number;
  relatedModelId?: number;
}

export interface NotificationResult {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Create notification
 */
export async function createNotification(data: NotificationData): Promise<NotificationResult | null> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const result = await db.insert(notifications).values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      content: data.content,
      relatedQuestionId: data.relatedQuestionId,
      relatedAnswerId: data.relatedAnswerId,
      relatedModelId: data.relatedModelId,
      isRead: false,
    } as any);

    // Get the created notification
    const created = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(1);

    if (!created || created.length === 0) {
      return null;
    }

    const notif = created[0];
    return {
      id: notif.id,
      userId: notif.userId,
      type: notif.type as NotificationType,
      title: notif.title,
      content: notif.content || "",
      isRead: notif.isRead,
      createdAt: notif.createdAt,
    };
  } catch (error) {
    logger.error({ error, userId: data.userId }, "Failed to create notification");
    return null;
  }
}

/**
 * Get user notifications
 */
export async function getUserNotifications(
  userId: number,
  limit: number = 20,
  unreadOnly: boolean = false
): Promise<NotificationResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let query = db.select().from(notifications);

    if (unreadOnly) {
      query = query.where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    } else {
      query = query.where(eq(notifications.userId, userId));
    }

    const results = await query.orderBy(desc(notifications.createdAt)).limit(limit);

    return results.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type as NotificationType,
      title: n.title,
      content: n.content || "",
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
  } catch (error) {
    logger.error({ error, userId }, "Failed to get user notifications");
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(notifications)
      .set({
        isRead: true,
      } as any)
      .where(eq(notifications.id, notificationId));

    return true;
  } catch (error) {
    logger.error({ error, notificationId }, "Failed to mark notification as read");
    return false;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(userId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(notifications)
      .set({
        isRead: true,
      } as any)
      .where(eq(notifications.userId, userId));

    return true;
  } catch (error) {
    logger.error({ error, userId }, "Failed to mark all notifications as read");
    return false;
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.delete(notifications).where(eq(notifications.id, notificationId));

    return true;
  } catch (error) {
    logger.error({ error, notificationId }, "Failed to delete notification");
    return false;
  }
}

/**
 * Get unread count
 */
export async function getUnreadCount(userId: number): Promise<number> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const result = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId) && eq(notifications.isRead, false));

    return result.length;
  } catch (error) {
    logger.error({ error, userId }, "Failed to get unread count");
    return 0;
  }
}

/**
 * Notify user of new response
 */
export async function notifyNewResponse(
  userId: number,
  questionId: number,
  answerId: number,
  modelName: string
): Promise<NotificationResult | null> {
  return createNotification({
    userId,
    type: "new_response",
    title: `New response from ${modelName}`,
    content: `A new AI response has been added to your question.`,
    relatedQuestionId: questionId,
    relatedAnswerId: answerId,
  });
}

/**
 * Notify user of synthesis completion
 */
export async function notifySynthesisComplete(
  userId: number,
  questionId: number
): Promise<NotificationResult | null> {
  return createNotification({
    userId,
    type: "synthesis_complete",
    title: "Synthesis Complete",
    content: "The knowledge synthesis for your question is ready.",
    relatedQuestionId: questionId,
  });
}

/**
 * Notify user of reputation gain
 */
export async function notifyReputationGained(
  userId: number,
  modelId: number,
  points: number
): Promise<NotificationResult | null> {
  return createNotification({
    userId,
    type: "reputation_gained",
    title: `Reputation +${points}`,
    content: `Your AI model gained ${points} reputation points.`,
    relatedModelId: modelId,
  });
}

/**
 * Notify user of achievement
 */
export async function notifyAchievementUnlocked(
  userId: number,
  modelId: number,
  badge: string,
  title: string
): Promise<NotificationResult | null> {
  return createNotification({
    userId,
    type: "achievement_unlocked",
    title: `Achievement Unlocked: ${title}`,
    content: `Your AI model earned the "${title}" badge.`,
    relatedModelId: modelId,
  });
}

/**
 * Notify user of trending question
 */
export async function notifyTrendingQuestion(
  userId: number,
  questionId: number,
  questionTitle: string
): Promise<NotificationResult | null> {
  return createNotification({
    userId,
    type: "trending_question",
    title: "Trending Question",
    content: `"${questionTitle}" is trending now.`,
    relatedQuestionId: questionId,
  });
}

export default {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  notifyNewResponse,
  notifySynthesisComplete,
  notifyReputationGained,
  notifyAchievementUnlocked,
  notifyTrendingQuestion,
};
