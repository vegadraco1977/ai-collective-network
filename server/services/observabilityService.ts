import { logger } from "../_core/logger";

/**
 * Observability Service - Metrics, logs, and usage tracking
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
}

// In-memory metrics storage (in production, use Prometheus)
const metrics: Metric[] = [];
const performanceData: number[] = [];

/**
 * Record metric
 */
export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  const metric: Metric = {
    name,
    value,
    timestamp: new Date(),
    tags,
  };

  metrics.push(metric);

  // Keep only last 10000 metrics in memory
  if (metrics.length > 10000) {
    metrics.shift();
  }

  logger.debug({ metric }, "Metric recorded");
}

/**
 * Record performance data
 */
export function recordPerformance(responseTime: number): void {
  performanceData.push(responseTime);

  // Keep only last 1000 data points
  if (performanceData.length > 1000) {
    performanceData.shift();
  }
}

/**
 * Get performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  if (performanceData.length === 0) {
    return {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      throughput: 0,
    };
  }

  const sorted = [...performanceData].sort((a, b) => a - b);
  const avg = performanceData.reduce((a, b) => a + b, 0) / performanceData.length;
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    avgResponseTime: Math.round(avg),
    p95ResponseTime: sorted[p95Index] || 0,
    p99ResponseTime: sorted[p99Index] || 0,
    errorRate: 0, // Would need error tracking
    throughput: performanceData.length, // Requests in current window
  };
}

/**
 * Get metrics by name
 */
export function getMetricsByName(name: string, limit: number = 100): Metric[] {
  return metrics
    .filter((m) => m.name === name)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

/**
 * Get metrics summary
 */
export function getMetricsSummary(): Record<string, number> {
  const summary: Record<string, number> = {};

  for (const metric of metrics) {
    if (!summary[metric.name]) {
      summary[metric.name] = 0;
    }
    summary[metric.name] += metric.value;
  }

  return summary;
}

/**
 * Log structured event
 */
export function logEvent(
  eventType: string,
  data: Record<string, any>,
  level: "info" | "warn" | "error" = "info"
): void {
  const logData = {
    eventType,
    ...data,
    timestamp: new Date().toISOString(),
  };

  switch (level) {
    case "error":
      logger.error(logData, `Event: ${eventType}`);
      break;
    case "warn":
      logger.warn(logData, `Event: ${eventType}`);
      break;
    default:
      logger.info(logData, `Event: ${eventType}`);
  }
}

/**
 * Track API call
 */
export function trackAPICall(
  endpoint: string,
  method: string,
  statusCode: number,
  responseTime: number
): void {
  recordMetric("api_call", 1, {
    endpoint,
    method,
    status: statusCode.toString(),
  });

  recordPerformance(responseTime);

  logEvent("api_call", {
    endpoint,
    method,
    statusCode,
    responseTime,
  });
}

/**
 * Track AI model call
 */
export function trackAIModelCall(
  modelId: number,
  modelName: string,
  responseTime: number,
  tokensUsed: number,
  success: boolean
): void {
  recordMetric("ai_call", 1, {
    modelId: modelId.toString(),
    modelName,
    success: success.toString(),
  });

  recordMetric("ai_tokens", tokensUsed, {
    modelId: modelId.toString(),
    modelName,
  });

  recordPerformance(responseTime);

  logEvent("ai_model_call", {
    modelId,
    modelName,
    responseTime,
    tokensUsed,
    success,
  });
}

/**
 * Track question creation
 */
export function trackQuestionCreation(userId: number, topicCount: number): void {
  recordMetric("question_created", 1, {
    userId: userId.toString(),
  });

  logEvent("question_created", {
    userId,
    topicCount,
  });
}

/**
 * Track answer creation
 */
export function trackAnswerCreation(
  questionId: number,
  modelId: number,
  qualityScore: number
): void {
  recordMetric("answer_created", 1, {
    questionId: questionId.toString(),
    modelId: modelId.toString(),
  });

  recordMetric("answer_quality", qualityScore, {
    questionId: questionId.toString(),
    modelId: modelId.toString(),
  });

  logEvent("answer_created", {
    questionId,
    modelId,
    qualityScore,
  });
}

/**
 * Track synthesis completion
 */
export function trackSynthesisCompletion(
  questionId: number,
  qualityScore: number,
  responseTime: number
): void {
  recordMetric("synthesis_completed", 1, {
    questionId: questionId.toString(),
  });

  recordMetric("synthesis_quality", qualityScore, {
    questionId: questionId.toString(),
  });

  recordPerformance(responseTime);

  logEvent("synthesis_completed", {
    questionId,
    qualityScore,
    responseTime,
  });
}

/**
 * Track cache hit/miss
 */
export function trackCacheEvent(
  key: string,
  hit: boolean,
  responseTime: number
): void {
  recordMetric("cache_event", 1, {
    key: key.substring(0, 50),
    hit: hit.toString(),
  });

  if (hit) {
    recordPerformance(responseTime);
  }

  logEvent("cache_event", {
    key,
    hit,
    responseTime,
  });
}

/**
 * Track error
 */
export function trackError(
  errorType: string,
  message: string,
  context?: Record<string, any>
): void {
  recordMetric("error", 1, {
    errorType,
  });

  logEvent("error_occurred", {
    errorType,
    message,
    ...context,
  }, "error");
}

/**
 * Get health check
 */
export function getHealthCheck(): Record<string, any> {
  const perf = getPerformanceMetrics();
  const summary = getMetricsSummary();

  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    performance: perf,
    metrics: {
      totalRequests: summary.api_call || 0,
      totalAICalls: summary.ai_call || 0,
      totalQuestions: summary.question_created || 0,
      totalAnswers: summary.answer_created || 0,
      totalSynthesis: summary.synthesis_completed || 0,
      totalErrors: summary.error || 0,
    },
  };
}

export default {
  recordMetric,
  recordPerformance,
  getPerformanceMetrics,
  getMetricsByName,
  getMetricsSummary,
  logEvent,
  trackAPICall,
  trackAIModelCall,
  trackQuestionCreation,
  trackAnswerCreation,
  trackSynthesisCompletion,
  trackCacheEvent,
  trackError,
  getHealthCheck,
};
