import { logger } from "../_core/logger";
import { getDb } from "../db";
import { questions, answers, aiReputation } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { executeOrchestratedDebate } from "./aiOrchestrator";
import { addSynthesisJob, addReputationJob } from "./queueService";

/**
 * Debate Engine - Orchestrates multi-AI debates with timeout, retry, and circuit breaker
 */

export interface DebateConfig {
  timeout?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  circuitBreakerThreshold?: number; // failure rate threshold
}

export interface DebateResult {
  questionId: number;
  responses: any[];
  bestResponse: any;
  debateStatus: "completed" | "partial" | "failed";
  executionTime: number;
}

// Circuit breaker state
const circuitBreakers = new Map<
  number,
  {
    failures: number;
    successes: number;
    state: "closed" | "open" | "half-open";
    lastFailureTime: number;
  }
>();

const DEFAULT_CONFIG: DebateConfig = {
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 2000,
  circuitBreakerThreshold: 0.5, // 50% failure rate
};

/**
 * Check circuit breaker status
 */
function checkCircuitBreaker(questionId: number): boolean {
  const breaker = circuitBreakers.get(questionId);

  if (!breaker) {
    // Initialize new breaker
    circuitBreakers.set(questionId, {
      failures: 0,
      successes: 0,
      state: "closed",
      lastFailureTime: 0,
    });
    return true;
  }

  // If open, check if enough time has passed to try half-open
  if (breaker.state === "open") {
    const timeSinceFailure = Date.now() - breaker.lastFailureTime;
    if (timeSinceFailure > 60000) {
      // 1 minute timeout
      breaker.state = "half-open";
      logger.debug({ questionId }, "Circuit breaker half-open");
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Record circuit breaker result
 */
function recordCircuitBreakerResult(questionId: number, success: boolean): void {
  const breaker = circuitBreakers.get(questionId) || {
    failures: 0,
    successes: 0,
    state: "closed",
    lastFailureTime: 0,
  };

  if (success) {
    breaker.successes++;
    if (breaker.state === "half-open") {
      breaker.state = "closed";
      breaker.failures = 0;
      logger.debug({ questionId }, "Circuit breaker closed");
    }
  } else {
    breaker.failures++;
    breaker.lastFailureTime = Date.now();

    const failureRate = breaker.failures / (breaker.failures + breaker.successes);
    if (failureRate > DEFAULT_CONFIG.circuitBreakerThreshold!) {
      breaker.state = "open";
      logger.warn({ questionId, failureRate }, "Circuit breaker opened");
    }
  }

  circuitBreakers.set(questionId, breaker);
}

/**
 * Execute debate with timeout
 */
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Debate timeout")), timeoutMs)
    ),
  ]);
}

/**
 * Retry logic with exponential backoff
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  delayMs: number
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(
        { attempt, maxRetries, error: lastError.message },
        "Debate attempt failed, retrying..."
      );

      if (attempt < maxRetries) {
        const backoffDelay = delayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  }

  throw lastError;
}

/**
 * Execute orchestrated debate with resilience
 */
export async function executeDebate(
  questionId: number,
  questionText: string,
  config: DebateConfig = {}
): Promise<DebateResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  try {
    // Check circuit breaker
    if (!checkCircuitBreaker(questionId)) {
      logger.warn({ questionId }, "Circuit breaker open, skipping debate");
      return {
        questionId,
        responses: [],
        bestResponse: null,
        debateStatus: "failed",
        executionTime: Date.now() - startTime,
      };
    }

    // Execute with timeout and retry
    const result = await executeWithTimeout(
      executeWithRetry(
        () =>
          executeOrchestratedDebate(
            questionId,
            questionText,
            "You are an expert in this field. Provide a comprehensive, well-researched answer."
          ),
        finalConfig.maxRetries!,
        finalConfig.retryDelay!
      ),
      finalConfig.timeout!
    );

    // Record success
    recordCircuitBreakerResult(questionId, true);

    // Store responses in database
    const db = await getDb();
    if (db && result.responses.length > 0) {
      for (const response of result.responses) {
        await db.insert(answers).values({
          questionId,
          aiModelId: response.modelId,
          content: response.content,
          latency: response.latency,
          tokensUsed: response.tokensUsed,
          qualityScore: response.qualityScore,
        });

        // Add reputation update job
        await addReputationJob(response.modelId);
      }

      // Update question status
      await db
        .update(questions)
        .set({
          status: "active",
          answerCount: result.responses.length,
        })
        .where(eq(questions.id, questionId));

      // Add synthesis job
      await addSynthesisJob(questionId);
    }

    logger.info(
      { questionId, responseCount: result.responses.length },
      "Debate executed successfully"
    );

    return {
      questionId,
      responses: result.responses,
      bestResponse: result.bestResponse,
      debateStatus: "completed",
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    recordCircuitBreakerResult(questionId, false);

    logger.error(
      { error, questionId },
      "Debate execution failed after retries"
    );

    return {
      questionId,
      responses: [],
      bestResponse: null,
      debateStatus: "failed",
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Get debate statistics
 */
export async function getDebateStats() {
  const stats = {
    totalCircuitBreakers: circuitBreakers.size,
    openBreakers: Array.from(circuitBreakers.values()).filter(
      (b) => b.state === "open"
    ).length,
    breakers: Array.from(circuitBreakers.entries()).map(([id, breaker]) => ({
      questionId: id,
      state: breaker.state,
      failures: breaker.failures,
      successes: breaker.successes,
    })),
  };

  return stats;
}

/**
 * Reset circuit breaker
 */
export function resetCircuitBreaker(questionId: number): void {
  circuitBreakers.delete(questionId);
  logger.info({ questionId }, "Circuit breaker reset");
}

export default {
  executeDebate,
  getDebateStats,
  resetCircuitBreaker,
};
