import { logger } from "../_core/logger";
import { getDb } from "../db";
import { debateDiagrams, answers, knowledgeSynthesis } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Diagram Service - Generates visual diagrams for debate outcomes
 */

export interface DiagramData {
  title: string;
  type: "flowchart" | "mindmap" | "graph" | "timeline";
  nodes: Array<{ id: string; label: string; color?: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
}

/**
 * Generate debate flowchart
 */
export function generateDebateFlowchart(
  questionId: number,
  responses: Array<{ modelId: number; modelName: string; content: string; score: number }>
): DiagramData {
  const nodes = [
    { id: "question", label: "Question", color: "#3498db" },
    ...responses.map((r, i) => ({
      id: `model-${r.modelId}`,
      label: `${r.modelName}\n(Score: ${r.score.toFixed(2)})`,
      color: r.score > 0.8 ? "#27ae60" : r.score > 0.6 ? "#f39c12" : "#e74c3c",
    })),
    { id: "synthesis", label: "Synthesis", color: "#9b59b6" },
  ];

  const edges = [
    ...responses.map((r) => ({
      from: "question",
      to: `model-${r.modelId}`,
      label: "AI Response",
    })),
    ...responses.map((r) => ({
      from: `model-${r.modelId}`,
      to: "synthesis",
      label: "Input",
    })),
  ];

  return {
    title: `Debate Flowchart - Question ${questionId}`,
    type: "flowchart",
    nodes,
    edges,
  };
}

/**
 * Generate knowledge synthesis mindmap
 */
export function generateSynthesisMindmap(
  questionId: number,
  synthesis: { summary: string; keyPoints: string[]; consensus: string }
): DiagramData {
  const nodes = [
    { id: "root", label: "Knowledge Synthesis", color: "#3498db" },
    { id: "summary", label: "Summary", color: "#2ecc71" },
    { id: "keypoints", label: "Key Points", color: "#f39c12" },
    { id: "consensus", label: "Consensus", color: "#9b59b6" },
    ...synthesis.keyPoints.map((kp, i) => ({
      id: `kp-${i}`,
      label: kp.substring(0, 50),
      color: "#ecf0f1",
    })),
  ];

  const edges = [
    { from: "root", to: "summary", label: "" },
    { from: "root", to: "keypoints", label: "" },
    { from: "root", to: "consensus", label: "" },
    ...synthesis.keyPoints.map((_, i) => ({
      from: "keypoints",
      to: `kp-${i}`,
      label: "",
    })),
  ];

  return {
    title: `Knowledge Synthesis Mindmap - Question ${questionId}`,
    type: "mindmap",
    nodes,
    edges,
  };
}

/**
 * Generate reputation timeline
 */
export function generateReputationTimeline(
  modelId: number,
  modelName: string,
  history: Array<{ date: Date; score: number }>
): DiagramData {
  const nodes = [
    { id: "start", label: `${modelName} Reputation`, color: "#3498db" },
    ...history.map((h, i) => ({
      id: `day-${i}`,
      label: `${h.date.toLocaleDateString()}\n${h.score.toFixed(1)}`,
      color: h.score > 70 ? "#27ae60" : h.score > 50 ? "#f39c12" : "#e74c3c",
    })),
  ];

  const edges = history.map((_, i) => ({
    from: i === 0 ? "start" : `day-${i - 1}`,
    to: `day-${i}`,
    label: "→",
  }));

  return {
    title: `Reputation Timeline - ${modelName}`,
    type: "timeline",
    nodes,
    edges,
  };
}

/**
 * Convert diagram to Mermaid syntax
 */
export function diagramToMermaid(diagram: DiagramData): string {
  if (diagram.type === "flowchart") {
    let mermaid = "graph TD\n";

    for (const node of diagram.nodes) {
      mermaid += `  ${node.id}["${node.label}"]\n`;
    }

    for (const edge of diagram.edges) {
      mermaid += `  ${edge.from} -->|${edge.label || ""}| ${edge.to}\n`;
    }

    return mermaid;
  } else if (diagram.type === "mindmap") {
    let mermaid = "mindmap\n  root((${diagram.title}))\n";

    for (const node of diagram.nodes) {
      if (node.id !== "root") {
        mermaid += `    ${node.label}\n`;
      }
    }

    return mermaid;
  } else if (diagram.type === "timeline") {
    let mermaid = "timeline\n";
    mermaid += `  title ${diagram.title}\n`;

    for (const node of diagram.nodes) {
      if (node.id !== "start") {
        mermaid += `  ${node.label}\n`;
      }
    }

    return mermaid;
  }

  return "";
}

/**
 * Save diagram
 */
export async function saveDiagram(
  questionId: number,
  diagramData: DiagramData,
  mermaidCode: string
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .insert(debateDiagrams)
      .values({
        questionId,
        diagramType: diagramData.type,
        diagramData: JSON.stringify(diagramData),
        mermaidCode,
      } as any)
      .onDuplicateKeyUpdate({
        set: {
          diagramData: JSON.stringify(diagramData),
          mermaidCode,
        },
      });

    logger.info({ questionId }, "Diagram saved");
    return true;
  } catch (error) {
    logger.error({ error, questionId }, "Failed to save diagram");
    return false;
  }
}

/**
 * Generate and save complete debate diagram
 */
export async function generateCompleteDiagram(
  questionId: number,
  responses: Array<{ modelId: number; modelName: string; content: string; score: number }>
): Promise<boolean> {
  try {
    // Generate flowchart
    const flowchart = generateDebateFlowchart(questionId, responses);
    const flowchartMermaid = diagramToMermaid(flowchart);

    // Save flowchart
    await saveDiagram(questionId, flowchart, flowchartMermaid);

    // Get synthesis for mindmap
    const db = await getDb();
    if (db) {
      const synthesis = await db
        .select()
        .from(knowledgeSynthesis)
        .where(eq(knowledgeSynthesis.questionId, questionId))
        .limit(1);

      if (synthesis && synthesis.length > 0) {
        const s = synthesis[0];
        const mindmap = generateSynthesisMindmap(questionId, {
          summary: s.summary || "",
          keyPoints: s.keyPoints ? JSON.parse(s.keyPoints) : [],
          consensus: s.consensus || "",
        });

        const mindmapMermaid = diagramToMermaid(mindmap);
        await saveDiagram(questionId, mindmap, mindmapMermaid);
      }
    }

    logger.info({ questionId }, "Complete diagram generated");
    return true;
  } catch (error) {
    logger.error({ error, questionId }, "Failed to generate complete diagram");
    return false;
  }
}

/**
 * Get diagram
 */
export async function getDiagram(questionId: number, type?: string) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let query = db.select().from(debateDiagrams).where(eq(debateDiagrams.questionId, questionId));

    if (type) {
      query = query.where(eq(debateDiagrams.diagramType, type));
    }

    const diagrams = await query;

    return diagrams.map((d) => ({
      id: d.id,
      questionId: d.questionId,
      type: d.diagramType,
      data: JSON.parse(d.diagramData || "{}"),
      mermaidCode: d.mermaidCode,
      createdAt: d.createdAt,
    }));
  } catch (error) {
    logger.error({ error, questionId }, "Failed to get diagram");
    return [];
  }
}

export default {
  generateDebateFlowchart,
  generateSynthesisMindmap,
  generateReputationTimeline,
  diagramToMermaid,
  saveDiagram,
  generateCompleteDiagram,
  getDiagram,
};
