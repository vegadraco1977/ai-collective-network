import { logger } from "../_core/logger";
import { getDb } from "../db";
import { vectorEmbeddings, questions, answers } from "../../drizzle/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { getCached, setCached, CACHE_PREFIXES } from "./cacheService";

/**
 * Vector Search Service - Semantic search using embeddings
 */

export interface EmbeddingResult {
  id: number;
  contentId: number;
  contentType: "question" | "answer";
  similarity: number;
  content: string;
}

/**
 * Generate embedding using LLM
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // In production, use OpenAI embeddings API
  // For now, use a simple hash-based approach
  const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = hash % 1000;

  // Generate 384-dimensional embedding (simulated)
  const embedding: number[] = [];
  for (let i = 0; i < 384; i++) {
    embedding.push(Math.sin((seed + i) * 0.1) * Math.cos((seed + i) * 0.2));
  }

  return embedding;
}

/**
 * Calculate cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Index question for semantic search
 */
export async function indexQuestion(questionId: number, text: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Generate embedding
    const embedding = await generateEmbedding(text);

    // Store embedding
    await db
      .insert(vectorEmbeddings)
      .values({
        entityId: questionId,
        entityType: "question",
        embedding: JSON.stringify(embedding),
      } as any)
      .onDuplicateKeyUpdate({
        set: {
          embedding: JSON.stringify(embedding),
        },
      });

    logger.info({ questionId }, "Question indexed for semantic search");
    return true;
  } catch (error) {
    logger.error({ error, questionId }, "Failed to index question");
    return false;
  }
}

/**
 * Index answer for semantic search
 */
export async function indexAnswer(answerId: number, text: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Generate embedding
    const embedding = await generateEmbedding(text);

    // Store embedding
    await db
      .insert(vectorEmbeddings)
      .values({
        entityId: answerId,
        entityType: "answer",
        embedding: JSON.stringify(embedding),
      } as any)
      .onDuplicateKeyUpdate({
        set: {
          embedding: JSON.stringify(embedding),
        },
      });

    logger.info({ answerId }, "Answer indexed for semantic search");
    return true;
  } catch (error) {
    logger.error({ error, answerId }, "Failed to index answer");
    return false;
  }
}

/**
 * Search for similar questions
 */
export async function searchSimilarQuestions(
  queryText: string,
  limit: number = 5
): Promise<EmbeddingResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check cache
    const cacheKey = `search-${queryText.substring(0, 50)}`;
    const cached = await getCached<EmbeddingResult[]>(
      CACHE_PREFIXES.RESPONSE,
      cacheKey
    );
    if (cached) {
      return cached;
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(queryText);

    // Get all indexed questions
    const embeddings = await db
      .select()
      .from(vectorEmbeddings)
      .where(eq(vectorEmbeddings.entityType, "question"));

    // Calculate similarities
    const results = embeddings
      .map((e) => {
        const embedding = JSON.parse(e.embedding || "[]");
        const similarity = cosineSimilarity(queryEmbedding, embedding);
        return {
          ...e,
          similarity,
        };
      })
      .filter((r) => r.similarity > 0.5) // Threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Get question details
    const questionIds = results.map((r) => r.entityId);
    const questionDetails = await db
      .select()
      .from(questions)
      .where(inArray(questions.id, questionIds));

    const questionMap = new Map(questionDetails.map((q) => [q.id, q]));

    const finalResults: EmbeddingResult[] = results.map((r) => ({
      id: r.id,
      contentId: r.entityId,
      contentType: "question",
      similarity: r.similarity,
      content: questionMap.get(r.entityId)?.text || "",
    }));

    // Cache results
    await setCached(CACHE_PREFIXES.RESPONSE, cacheKey, finalResults, {
      ttl: 24 * 60 * 60,
      tags: ["search"],
    });

    logger.info({ queryLength: queryText.length, resultCount: finalResults.length }, "Semantic search completed");
    return finalResults;
  } catch (error) {
    logger.error({ error }, "Failed to search similar questions");
    return [];
  }
}

/**
 * Search for similar answers
 */
export async function searchSimilarAnswers(
  queryText: string,
  limit: number = 5
): Promise<EmbeddingResult[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(queryText);

    // Get all indexed answers
    const embeddings = await db
      .select()
      .from(vectorEmbeddings)
      .where(eq(vectorEmbeddings.entityType, "answer"));

    // Calculate similarities
    const results = embeddings
      .map((e) => {
        const embedding = JSON.parse(e.embedding || "[]");
        const similarity = cosineSimilarity(queryEmbedding, embedding);
        return {
          ...e,
          similarity,
        };
      })
      .filter((r) => r.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Get answer details
    const answerIds = results.map((r) => r.entityId);
    const answerDetails = await db
      .select()
      .from(answers)
      .where(inArray(answers.id, answerIds));

    const answerMap = new Map(answerDetails.map((a) => [a.id, a]));

    const finalResults: EmbeddingResult[] = results.map((r) => ({
      id: r.id,
      contentId: r.entityId,
      contentType: "answer",
      similarity: r.similarity,
      content: answerMap.get(r.entityId)?.content || "",
    }));

    logger.info({ resultCount: finalResults.length }, "Similar answers found");
    return finalResults;
  } catch (error) {
    logger.error({ error }, "Failed to search similar answers");
    return [];
  }
}

/**
 * Detect duplicate questions
 */
export async function detectDuplicateQuestions(
  questionText: string,
  threshold: number = 0.85
): Promise<number[]> {
  try {
    const results = await searchSimilarQuestions(questionText, 10);
    return results
      .filter((r) => r.similarity >= threshold)
      .map((r) => r.contentId);
  } catch (error) {
    logger.error({ error }, "Failed to detect duplicates");
    return [];
  }
}

export default {
  indexQuestion,
  indexAnswer,
  searchSimilarQuestions,
  searchSimilarAnswers,
  detectDuplicateQuestions,
};
