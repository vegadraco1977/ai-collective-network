import { invokeLLM } from "../_core/llm";
import { logger } from "../_core/logger";
import { getDb } from "../db";
import { answers, knowledgeSynthesis, questions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { setCached, CACHE_PREFIXES, CACHE_TTL } from "./cacheService";

/**
 * Knowledge Synthesis Service - Combines multiple AI responses into consensus
 */

export interface SynthesisResult {
  questionId: number;
  summary: string;
  keyPoints: string[];
  consensus: string;
  disagreements: string[];
  qualityScore: number;
}

/**
 * Extract key points from responses
 */
async function extractKeyPoints(responses: string[]): Promise<string[]> {
  const combinedText = responses.join("\n\n---\n\n");

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Extract the most important and unique key points from these responses. Return as a JSON array of strings.",
      },
      {
        role: "user",
        content: `Extract key points from these responses:\n\n${combinedText}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "key_points",
        strict: true,
        schema: {
          type: "object",
          properties: {
            points: {
              type: "array",
              items: { type: "string" },
              description: "List of key points",
            },
          },
          required: ["points"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const content = (result.choices[0]?.message.content || "{}") as string;
    const parsed = JSON.parse(content);
    return parsed.points || [];
  } catch (error) {
    logger.error({ error }, "Failed to parse key points");
    return [];
  }
}

/**
 * Detect consensus from responses
 */
async function detectConsensus(responses: string[]): Promise<{
  consensus: string;
  disagreements: string[];
}> {
  const combinedText = responses.join("\n\n---\n\n");

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Analyze these responses to identify areas of consensus and disagreement. Return as JSON.",
      },
      {
        role: "user",
        content: `Analyze consensus in these responses:\n\n${combinedText}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "consensus_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            consensus: {
              type: "string",
              description: "Areas of agreement",
            },
            disagreements: {
              type: "array",
              items: { type: "string" },
              description: "Areas of disagreement",
            },
          },
          required: ["consensus", "disagreements"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const content = (result.choices[0]?.message.content || "{}") as string;
    const parsed = JSON.parse(content);
    return {
      consensus: parsed.consensus || "",
      disagreements: parsed.disagreements || [],
    };
  } catch (error) {
    logger.error({ error }, "Failed to parse consensus");
    return { consensus: "", disagreements: [] };
  }
}

/**
 * Generate synthesis summary
 */
async function generateSummary(
  questionText: string,
  responses: string[]
): Promise<string> {
  const combinedText = responses.join("\n\n---\n\n");

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Create a comprehensive synthesis of these responses. Combine the best insights into a coherent answer.",
      },
      {
        role: "user",
        content: `Question: ${questionText}\n\nResponses:\n${combinedText}\n\nCreate a synthesis that combines the best insights.`,
      },
    ],
  });

  return (result.choices[0]?.message.content || "") as string;
}

/**
 * Calculate synthesis quality score
 */
function calculateQualityScore(
  summary: string,
  keyPoints: string[],
  consensus: string
): number {
  let score = 0.5;

  // Longer summary = more comprehensive
  if (summary.length > 500) score += 0.15;
  if (summary.length > 1000) score += 0.1;

  // More key points = more thorough
  if (keyPoints.length >= 3) score += 0.1;
  if (keyPoints.length >= 5) score += 0.05;

  // Strong consensus = higher quality
  if (consensus.length > 200) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Execute knowledge synthesis
 */
export async function synthesizeKnowledge(
  questionId: number
): Promise<SynthesisResult | null> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get question
    const question = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question || question.length === 0) {
      throw new Error(`Question ${questionId} not found`);
    }

    // Get all answers
    const questionAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.questionId, questionId));

    if (questionAnswers.length === 0) {
      logger.warn({ questionId }, "No answers found for synthesis");
      return null;
    }

    const responseTexts = questionAnswers.map((a) => a.content);

    logger.info({ questionId, answerCount: responseTexts.length }, "Starting synthesis");

    // Extract key points
    const keyPoints = await extractKeyPoints(responseTexts);

    // Detect consensus
    const { consensus, disagreements } = await detectConsensus(responseTexts);

    // Generate summary
    const summary = await generateSummary(question[0].text, responseTexts);

    // Calculate quality score
    const qualityScore = calculateQualityScore(summary, keyPoints, consensus);

    const result: SynthesisResult = {
      questionId,
      summary,
      keyPoints,
      consensus,
      disagreements,
      qualityScore,
    };

    // Store synthesis in database
    await db
      .insert(knowledgeSynthesis)
      .values({
        questionId,
        summary,
        keyPoints: JSON.stringify(keyPoints),
        consensus,
        disagreements: JSON.stringify(disagreements),
        qualityScore: qualityScore.toString() as any,
      } as any)
      .onDuplicateKeyUpdate({
        set: {
          summary,
          keyPoints: JSON.stringify(keyPoints),
          consensus,
          disagreements: JSON.stringify(disagreements),
          qualityScore: qualityScore.toString() as any,
        },
      });

    // Cache synthesis
    await setCached(
      CACHE_PREFIXES.SYNTHESIS,
      `q-${questionId}`,
      result,
      {
        ttl: CACHE_TTL.SYNTHESIS,
        tags: [`question-${questionId}`],
      }
    );

    logger.info({ questionId, qualityScore }, "Synthesis completed");

    return result;
  } catch (error) {
    logger.error({ error, questionId }, "Synthesis failed");
    return null;
  }
}

/**
 * Get synthesis for question
 */
export async function getSynthesis(questionId: number): Promise<SynthesisResult | null> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const synthesis = await db
      .select()
      .from(knowledgeSynthesis)
      .where(eq(knowledgeSynthesis.questionId, questionId))
      .limit(1);

    if (!synthesis || synthesis.length === 0) {
      return null;
    }

    const s = synthesis[0];
    return {
      questionId,
      summary: s.summary || "",
      keyPoints: s.keyPoints ? JSON.parse(s.keyPoints) : [],
      consensus: s.consensus || "",
      disagreements: s.disagreements ? JSON.parse(s.disagreements) : [],
      qualityScore: s.qualityScore ? parseFloat(String(s.qualityScore)) : 0,
    };
  } catch (error) {
    logger.error({ error, questionId }, "Failed to get synthesis");
    return null;
  }
}

export default {
  synthesizeKnowledge,
  getSynthesis,
};
