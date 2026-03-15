import { Queue, Worker, QueueScheduler } from "bullmq";
import Redis from "ioredis";
import { logger } from "../_core/logger";

/**
 * Queue Service - BullMQ-based job queue for async processing
 * Handles debates, synthesis, reputation updates, feed generation, notifications
 */

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

// Define job types
export interface DebateJobData {
  questionId: number;
  priority?: number;
}

export interface SynthesisJobData {
  questionId: number;
}

export interface ReputationJobData {
  aiModelId: number;
}

export interface FeedJobData {
  userId: number;
  feedType: "trending" | "latest" | "recommended" | "following";
}

export interface NotificationJobData {
  userId: number;
  type: string;
  title: string;
  content: string;
  relatedQuestionId?: number;
  relatedAnswerId?: number;
  relatedModelId?: number;
}

export interface DiagramJobData {
  questionId: number;
  diagramType: "flow" | "consensus" | "comparison" | "timeline";
}

// Create queues
export const debateQueue = new Queue<DebateJobData>("debate", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const synthesisQueue = new Queue<SynthesisJobData>("synthesis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
  },
});

export const reputationQueue = new Queue<ReputationJobData>("reputation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
  },
});

export const feedQueue = new Queue<FeedJobData>("feed", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
  },
});

export const notificationQueue = new Queue<NotificationJobData>("notification", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

export const diagramQueue = new Queue<DiagramJobData>("diagram", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
  },
});

/**
 * Add debate job to queue
 */
export async function addDebateJob(questionId: number, priority = 0): Promise<string> {
  try {
    const job = await debateQueue.add(
      `debate-${questionId}` as any,
      { questionId, priority } as any,
      {
        priority: priority > 0 ? priority : undefined,
        delay: priority > 0 ? 0 : 1000, // Delay non-priority jobs
      }
    );

    logger.info({ questionId, jobId: job.id }, "Debate job added to queue");
    return job.id || "";
  } catch (error) {
    logger.error({ error, questionId }, "Failed to add debate job");
    throw error;
  }
}

/**
 * Add synthesis job to queue
 */
export async function addSynthesisJob(questionId: number): Promise<string> {
  try {
    const job = await synthesisQueue.add(`synthesis-${questionId}` as any, { questionId } as any);

    logger.info({ questionId, jobId: job.id }, "Synthesis job added to queue");
    return job.id || "";
  } catch (error) {
    logger.error({ error, questionId }, "Failed to add synthesis job");
    throw error;
  }
}

/**
 * Add reputation update job to queue
 */
export async function addReputationJob(aiModelId: number): Promise<string> {
  try {
    const job = await reputationQueue.add(`reputation-${aiModelId}` as any, { aiModelId } as any);

    logger.info({ aiModelId, jobId: job.id }, "Reputation job added to queue");
    return job.id || "";
  } catch (error) {
    logger.error({ error, aiModelId }, "Failed to add reputation job");
    throw error;
  }
}

/**
 * Add feed update job to queue
 */
export async function addFeedJob(
  userId: number,
  feedType: "trending" | "latest" | "recommended" | "following"
): Promise<string> {
  try {
    const job = await feedQueue.add(`feed-${userId}-${feedType}` as any, { userId, feedType } as any);

    logger.info({ userId, feedType, jobId: job.id }, "Feed job added to queue");
    return job.id || "";
  } catch (error) {
    logger.error({ error, userId, feedType }, "Failed to add feed job");
    throw error;
  }
}

/**
 * Add notification job to queue
 */
export async function addNotificationJob(data: NotificationJobData): Promise<string> {
  try {
    const job = await notificationQueue.add(`notification-${data.userId}` as any, data as any);

    logger.info({ userId: data.userId, type: data.type, jobId: job.id }, "Notification job added to queue");
    return job.id || "";
  } catch (error) {
    logger.error({ error, userId: data.userId }, "Failed to add notification job");
    throw error;
  }
}

/**
 * Add diagram generation job to queue
 */
export async function addDiagramJob(questionId: number, diagramType: string): Promise<string> {
  try {
    const job = await diagramQueue.add(`diagram-${questionId}` as any, {
      questionId,
      diagramType: diagramType as "flow" | "consensus" | "comparison" | "timeline",
    } as any);

    logger.info({ questionId, diagramType, jobId: job.id }, "Diagram job added to queue");
    return job.id || "";
  } catch (error) {
    logger.error({ error, questionId }, "Failed to add diagram job");
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  try {
    const stats = {
      debate: await debateQueue.getJobCounts(),
      synthesis: await synthesisQueue.getJobCounts(),
      reputation: await reputationQueue.getJobCounts(),
      feed: await feedQueue.getJobCounts(),
      notification: await notificationQueue.getJobCounts(),
      diagram: await diagramQueue.getJobCounts(),
    };

    return stats;
  } catch (error) {
    logger.error({ error }, "Failed to get queue stats");
    return null;
  }
}

/**
 * Pause all queues
 */
export async function pauseAllQueues(): Promise<void> {
  try {
    await Promise.all([
      debateQueue.pause(),
      synthesisQueue.pause(),
      reputationQueue.pause(),
      feedQueue.pause(),
      notificationQueue.pause(),
      diagramQueue.pause(),
    ]);

    logger.info("All queues paused");
  } catch (error) {
    logger.error({ error }, "Failed to pause queues");
  }
}

/**
 * Resume all queues
 */
export async function resumeAllQueues(): Promise<void> {
  try {
    await Promise.all([
      debateQueue.resume(),
      synthesisQueue.resume(),
      reputationQueue.resume(),
      feedQueue.resume(),
      notificationQueue.resume(),
      diagramQueue.resume(),
    ]);

    logger.info("All queues resumed");
  } catch (error) {
    logger.error({ error }, "Failed to resume queues");
  }
}

export default {
  debateQueue,
  synthesisQueue,
  reputationQueue,
  feedQueue,
  notificationQueue,
  diagramQueue,
  addDebateJob,
  addSynthesisJob,
  addReputationJob,
  addFeedJob,
  addNotificationJob,
  addDiagramJob,
  getQueueStats,
  pauseAllQueues,
  resumeAllQueues,
};
