import { invokeLLM } from "../_core/llm";
import { logger } from "../_core/logger";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { aiModels, answers } from "../../drizzle/schema";
import { getCached, setCached, CACHE_PREFIXES, CACHE_TTL } from "./cacheService";
import crypto from "crypto";

/**
 * AI Orchestrator - Manages multiple AI models for parallel execution and ranking
 */

export interface OrchestratorResponse {
  modelId: number;
  modelName: string;
  content: string;
  latency: number;
  tokensUsed?: number;
  qualityScore?: number;
}

export interface OrchestratorResult {
  questionId: number;
  responses: OrchestratorResponse[];
  bestResponse: OrchestratorResponse;
  executionTime: number;
}

/**
 * Generate question hash for caching
 */
function generateQuestionHash(questionText: string): string {
  return crypto.createHash("sha256").update(questionText).digest("hex");
}

/**
 * Get enabled AI models sorted by priority
 */
async function getAvailableModels() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const models = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.enabled, true))
    .orderBy(aiModels.priority);

  return models;
}

/**
 * Execute query on a single model
 */
async function executeModelQuery(
  modelId: number,
  modelName: string,
  questionText: string,
  systemPrompt: string
): Promise<OrchestratorResponse | null> {
  const startTime = Date.now();

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: questionText },
      ],
    });

    const latency = Date.now() - startTime;
    const content = response.choices[0]?.message.content || "";

    logger.debug(
      { modelId, modelName, latency },
      "Model query executed successfully"
    );

    return {
      modelId,
      modelName,
      content,
      latency,
      tokensUsed: response.usage?.total_tokens,
    };
  } catch (error) {
    logger.error({ error, modelId, modelName }, "Model query failed");
    return null;
  }
}

/**
 * Calculate quality score based on response characteristics
 */
function calculateQualityScore(response: string): number {
  let score = 0.5; // Base score

  // Longer, more detailed responses score higher
  if (response.length > 500) score += 0.15;
  if (response.length > 1000) score += 0.1;

  // Structured responses score higher
  if (response.includes("\n") && response.split("\n").length > 3) score += 0.1;

  // Responses with examples score higher
  if (response.match(/example|instance|such as|e\.g\.|for example/i)) score += 0.1;

  // Cap at 1.0
  return Math.min(score, 1.0);
}

/**
 * Rank responses by quality
 */
function rankResponses(responses: OrchestratorResponse[]): OrchestratorResponse[] {
  return responses
    .map((r) => ({
      ...r,
      qualityScore: calculateQualityScore(r.content),
    }))
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
}

/**
 * Execute orchestrated debate - run multiple models in parallel
 */
export async function executeOrchestratedDebate(
  questionId: number,
  questionText: string,
  systemPrompt?: string
): Promise<OrchestratorResult> {
  const startTime = Date.now();
  const questionHash = generateQuestionHash(questionText);

  // Check cache first
  const cachedResponses = await getCached<OrchestratorResponse[]>(
    CACHE_PREFIXES.RESPONSE,
    questionHash
  );

  if (cachedResponses && cachedResponses.length > 0) {
    logger.info({ questionId, questionHash }, "Using cached responses");

    const ranked = rankResponses(cachedResponses);
    return {
      questionId,
      responses: ranked,
      bestResponse: ranked[0] || ranked[0],
      executionTime: Date.now() - startTime,
    };
  }

  try {
    const models = await getAvailableModels();

    if (models.length === 0) {
      throw new Error("No available AI models");
    }

    const defaultSystemPrompt =
      systemPrompt ||
      "You are a helpful expert assistant. Provide clear, accurate, and well-structured responses.";

    // Execute all models in parallel
    const promises = models.map((model) =>
      executeModelQuery(
        model.id,
        model.name,
        questionText,
        defaultSystemPrompt
      )
    );

    const results = await Promise.allSettled(promises);

    // Collect successful responses
    const responses: OrchestratorResponse[] = results
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter((r): r is OrchestratorResponse => r !== null);

    if (responses.length === 0) {
      throw new Error("All models failed to respond");
    }

    // Rank responses
    const ranked = rankResponses(responses);

    // Cache the responses
    await setCached(
      CACHE_PREFIXES.RESPONSE,
      questionHash,
      ranked,
      {
        ttl: CACHE_TTL.RESPONSE,
        tags: [`question-${questionId}`],
      }
    );

    logger.info(
      { questionId, modelCount: responses.length },
      "Orchestrated debate completed"
    );

    return {
      questionId,
      responses: ranked,
      bestResponse: ranked[0] || ranked[0],
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ error, questionId }, "Orchestrated debate failed");
    throw error;
  }
}

/**
 * Select best model for a specific topic
 */
export async function selectBestModelForTopic(topicId: number): Promise<any> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get model with highest expertise score for this topic
  const result = await db.query.modelExpertiseTopics.findFirst({
    where: (met, { eq }) => eq(met.topicId, topicId),
    orderBy: (met, { desc }) => desc(met.expertiseScore),
    with: {
      aiModel: true,
    },
  });

  return result?.aiModel || null;
}

/**
 * Get model statistics
 */
export async function getModelStatistics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const models = await db.select().from(aiModels);

  return {
    total: models.length,
    enabled: models.filter((m) => m.enabled).length,
    disabled: models.filter((m) => !m.enabled).length,
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      enabled: m.enabled,
      priority: m.priority,
    })),
  };
}

export default {
  executeOrchestratedDebate,
  selectBestModelForTopic,
  getModelStatistics,
};
