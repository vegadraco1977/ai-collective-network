import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  bio: text("bio"),
  avatar: varchar("avatar", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  openIdIdx: index("idx_users_openId").on(table.openId),
  roleIdx: index("idx_users_role").on(table.role),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Topics Table
export const topics = mysqlTable("topics", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  parentTopicId: int("parentTopicId"),
  questionCount: int("questionCount").default(0).notNull(),
  answerCount: int("answerCount").default(0).notNull(),
  trendingScore: decimal("trendingScore", { precision: 10, scale: 2 }).default("0.00"),
  popularity: int("popularity").default(0),
  vectorEmbedding: text("vectorEmbedding"), // JSON stringified 1536-dim vector
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("idx_topics_name").on(table.name),
  trendingIdx: index("idx_topics_trending").on(table.trendingScore),
}));

export type Topic = typeof topics.$inferSelect;
export type InsertTopic = typeof topics.$inferInsert;

// Questions Table
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  text: text("text").notNull(),
  description: text("description"),
  questionHash: varchar("questionHash", { length: 64 }), // SHA256 hash for duplicate detection
  status: mysqlEnum("status", ["pending", "active", "completed", "archived"]).default("pending").notNull(),
  viewCount: int("viewCount").default(0),
  voteCount: int("voteCount").default(0),
  answerCount: int("answerCount").default(0),
  vectorEmbedding: text("vectorEmbedding"), // JSON stringified 1536-dim vector
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_questions_userId").on(table.userId),
  statusIdx: index("idx_questions_status").on(table.status),
  hashIdx: index("idx_questions_hash").on(table.questionHash),
  createdAtIdx: index("idx_questions_createdAt").on(table.createdAt),
}));

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

// Question Topics Junction Table
export const questionTopics = mysqlTable("question_topics", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(),
  topicId: int("topicId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  questionIdIdx: index("idx_qt_questionId").on(table.questionId),
  topicIdIdx: index("idx_qt_topicId").on(table.topicId),
}));

export type QuestionTopic = typeof questionTopics.$inferSelect;
export type InsertQuestionTopic = typeof questionTopics.$inferInsert;

// AI Models Table
export const aiModels = mysqlTable("ai_models", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: mysqlEnum("provider", ["openai", "anthropic", "local", "other"]).notNull(),
  apiKey: text("apiKey"),
  endpoint: varchar("endpoint", { length: 512 }),
  model: varchar("model", { length: 255 }),
  enabled: boolean("enabled").default(true).notNull(),
  priority: int("priority").default(0), // Higher priority = selected first
  maxTokens: int("maxTokens").default(2000),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.7"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  enabledIdx: index("idx_aimodels_enabled").on(table.enabled),
  providerIdx: index("idx_aimodels_provider").on(table.provider),
}));

export type AIModel = typeof aiModels.$inferSelect;
export type InsertAIModel = typeof aiModels.$inferInsert;

// Answers Table
export const answers = mysqlTable("answers", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(),
  aiModelId: int("aiModelId").notNull(),
  content: text("content").notNull(),
  latency: int("latency"), // milliseconds
  tokensUsed: int("tokensUsed"),
  qualityScore: decimal("qualityScore", { precision: 3, scale: 2 }), // 0-1 score
  voteCount: int("voteCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  questionIdIdx: index("idx_answers_questionId").on(table.questionId),
  aiModelIdIdx: index("idx_answers_aiModelId").on(table.aiModelId),
  createdAtIdx: index("idx_answers_createdAt").on(table.createdAt),
}));

export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = typeof answers.$inferInsert;

// Validations Table (User votes on answers)
export const validations = mysqlTable("validations", {
  id: int("id").autoincrement().primaryKey(),
  answerId: int("answerId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating"), // 1-5 stars
  isCorrect: boolean("isCorrect"), // true/false/null
  feedback: text("feedback"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  answerIdIdx: index("idx_validations_answerId").on(table.answerId),
  userIdIdx: index("idx_validations_userId").on(table.userId),
}));

export type Validation = typeof validations.$inferSelect;
export type InsertValidation = typeof validations.$inferInsert;

// AI Reputation Table
export const aiReputation = mysqlTable("ai_reputation", {
  id: int("id").autoincrement().primaryKey(),
  aiModelId: int("aiModelId").notNull().unique(),
  totalResponses: int("totalResponses").default(0).notNull(),
  averageRating: decimal("averageRating", { precision: 3, scale: 2 }).default("0.00"),
  correctCount: int("correctCount").default(0).notNull(),
  incorrectCount: int("incorrectCount").default(0).notNull(),
  totalVotes: int("totalVotes").default(0).notNull(),
  reputationScore: decimal("reputationScore", { precision: 5, scale: 2 }).default("0.00"),
  accuracyRate: decimal("accuracyRate", { precision: 5, scale: 4 }).default("0.0000"),
  averageResponseTime: int("averageResponseTime").default(0), // milliseconds
  consistencyScore: decimal("consistencyScore", { precision: 3, scale: 2 }).default("0.00"),
  trustScore: decimal("trustScore", { precision: 5, scale: 2 }).default("0.00"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  aiModelIdIdx: index("idx_aireputation_aiModelId").on(table.aiModelId),
  reputationScoreIdx: index("idx_aireputation_score").on(table.reputationScore),
}));

export type AIReputation = typeof aiReputation.$inferSelect;
export type InsertAIReputation = typeof aiReputation.$inferInsert;

// AI Reputation History Table
export const aiReputationHistory = mysqlTable("ai_reputation_history", {
  id: int("id").autoincrement().primaryKey(),
  aiModelId: int("aiModelId").notNull(),
  reputationScore: decimal("reputationScore", { precision: 5, scale: 2 }).notNull(),
  accuracyRate: decimal("accuracyRate", { precision: 5, scale: 4 }),
  averageResponseTime: int("averageResponseTime"),
  consistencyScore: decimal("consistencyScore", { precision: 3, scale: 2 }),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
}, (table) => ({
  aiModelIdIdx: index("idx_airh_aiModelId").on(table.aiModelId),
  recordedAtIdx: index("idx_airh_recordedAt").on(table.recordedAt),
}));

export type AIReputationHistory = typeof aiReputationHistory.$inferSelect;
export type InsertAIReputationHistory = typeof aiReputationHistory.$inferInsert;

// AI Model Achievements Table
export const aiModelAchievements = mysqlTable("ai_model_achievements", {
  id: int("id").autoincrement().primaryKey(),
  aiModelId: int("aiModelId").notNull(),
  badge: varchar("badge", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
}, (table) => ({
  aiModelIdIdx: index("idx_aiach_aiModelId").on(table.aiModelId),
}));

export type AIModelAchievement = typeof aiModelAchievements.$inferSelect;
export type InsertAIModelAchievement = typeof aiModelAchievements.$inferInsert;

// Knowledge Synthesis Table
export const knowledgeSynthesis = mysqlTable("knowledge_synthesis", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull().unique(),
  summary: text("summary"),
  keyPoints: text("keyPoints"), // JSON array
  consensus: text("consensus"),
  disagreements: text("disagreements"), // JSON array
  qualityScore: decimal("qualityScore", { precision: 3, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  questionIdIdx: index("idx_ks_questionId").on(table.questionId),
}));

export type KnowledgeSynthesis = typeof knowledgeSynthesis.$inferSelect;
export type InsertKnowledgeSynthesis = typeof knowledgeSynthesis.$inferInsert;

// Feed Items Table
export const feedItems = mysqlTable("feed_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  feedType: mysqlEnum("feedType", ["trending", "latest", "recommended", "following"]).notNull(),
  score: decimal("score", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
}, (table) => ({
  userIdIdx: index("idx_fi_userId").on(table.userId),
  feedTypeIdx: index("idx_fi_feedType").on(table.feedType),
  scoreIdx: index("idx_fi_score").on(table.score),
}));

export type FeedItem = typeof feedItems.$inferSelect;
export type InsertFeedItem = typeof feedItems.$inferInsert;

// Notifications Table
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "new_response",
    "synthesis_complete",
    "reputation_gained",
    "achievement_unlocked",
    "trending_question",
    "follow",
    "admin_message"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  relatedQuestionId: int("relatedQuestionId"),
  relatedAnswerId: int("relatedAnswerId"),
  relatedModelId: int("relatedModelId"),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_notif_userId").on(table.userId),
  typeIdx: index("idx_notif_type").on(table.type),
  isReadIdx: index("idx_notif_isRead").on(table.isRead),
}));

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Vector Embeddings Table (for semantic search)
export const vectorEmbeddings = mysqlTable("vector_embeddings", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["question", "answer", "topic"]).notNull(),
  entityId: int("entityId").notNull(),
  embedding: text("embedding").notNull(), // JSON stringified 1536-dim vector
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  entityTypeIdx: index("idx_ve_entityType").on(table.entityType),
  entityIdIdx: index("idx_ve_entityId").on(table.entityId),
}));

export type VectorEmbedding = typeof vectorEmbeddings.$inferSelect;
export type InsertVectorEmbedding = typeof vectorEmbeddings.$inferInsert;

// User Follows Table
export const userFollows = mysqlTable("user_follows", {
  id: int("id").autoincrement().primaryKey(),
  followerId: int("followerId").notNull(),
  followingId: int("followingId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  followerIdIdx: index("idx_uf_followerId").on(table.followerId),
  followingIdIdx: index("idx_uf_followingId").on(table.followingId),
}));

export type UserFollow = typeof userFollows.$inferSelect;
export type InsertUserFollow = typeof userFollows.$inferInsert;

// User Topic Preferences Table
export const userTopicPreferences = mysqlTable("user_topic_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  topicId: int("topicId").notNull(),
  isFollowing: boolean("isFollowing").default(true),
  interestScore: decimal("interestScore", { precision: 3, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_utp_userId").on(table.userId),
  topicIdIdx: index("idx_utp_topicId").on(table.topicId),
}));

export type UserTopicPreference = typeof userTopicPreferences.$inferSelect;
export type InsertUserTopicPreference = typeof userTopicPreferences.$inferInsert;

// Model Expertise Topics Table
export const modelExpertiseTopics = mysqlTable("model_expertise_topics", {
  id: int("id").autoincrement().primaryKey(),
  aiModelId: int("aiModelId").notNull(),
  topicId: int("topicId").notNull(),
  expertiseScore: decimal("expertiseScore", { precision: 3, scale: 2 }).default("0.50"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  aiModelIdIdx: index("idx_met_aiModelId").on(table.aiModelId),
  topicIdIdx: index("idx_met_topicId").on(table.topicId),
}));

export type ModelExpertiseTopic = typeof modelExpertiseTopics.$inferSelect;
export type InsertModelExpertiseTopic = typeof modelExpertiseTopics.$inferInsert;

// Debate Diagrams Table
export const debateDiagrams = mysqlTable("debate_diagrams", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull().unique(),
  diagramType: mysqlEnum("diagramType", ["flow", "consensus", "comparison", "timeline"]).notNull(),
  mermaidCode: text("mermaidCode"),
  imageUrl: varchar("imageUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  questionIdIdx: index("idx_dd_questionId").on(table.questionId),
}));

export type DebateDiagram = typeof debateDiagrams.$inferSelect;
export type InsertDebateDiagram = typeof debateDiagrams.$inferInsert;
