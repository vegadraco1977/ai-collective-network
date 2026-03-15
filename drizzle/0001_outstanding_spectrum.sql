CREATE TABLE `ai_model_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`aiModelId` int NOT NULL,
	`badge` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`earnedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_model_achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_models` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`provider` enum('openai','anthropic','local','other') NOT NULL,
	`apiKey` text,
	`endpoint` varchar(512),
	`model` varchar(255),
	`enabled` boolean NOT NULL DEFAULT true,
	`priority` int DEFAULT 0,
	`maxTokens` int DEFAULT 2000,
	`temperature` decimal(3,2) DEFAULT '0.7',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_models_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_reputation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`aiModelId` int NOT NULL,
	`totalResponses` int NOT NULL DEFAULT 0,
	`averageRating` decimal(3,2) DEFAULT '0.00',
	`correctCount` int NOT NULL DEFAULT 0,
	`incorrectCount` int NOT NULL DEFAULT 0,
	`totalVotes` int NOT NULL DEFAULT 0,
	`reputationScore` decimal(5,2) DEFAULT '0.00',
	`accuracyRate` decimal(5,4) DEFAULT '0.0000',
	`averageResponseTime` int DEFAULT 0,
	`consistencyScore` decimal(3,2) DEFAULT '0.00',
	`trustScore` decimal(5,2) DEFAULT '0.00',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_reputation_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_reputation_aiModelId_unique` UNIQUE(`aiModelId`)
);
--> statement-breakpoint
CREATE TABLE `ai_reputation_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`aiModelId` int NOT NULL,
	`reputationScore` decimal(5,2) NOT NULL,
	`accuracyRate` decimal(5,4),
	`averageResponseTime` int,
	`consistencyScore` decimal(3,2),
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_reputation_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`aiModelId` int NOT NULL,
	`content` text NOT NULL,
	`latency` int,
	`tokensUsed` int,
	`qualityScore` decimal(3,2),
	`voteCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `debate_diagrams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`diagramType` enum('flow','consensus','comparison','timeline') NOT NULL,
	`mermaidCode` text,
	`imageUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `debate_diagrams_id` PRIMARY KEY(`id`),
	CONSTRAINT `debate_diagrams_questionId_unique` UNIQUE(`questionId`)
);
--> statement-breakpoint
CREATE TABLE `feed_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`feedType` enum('trending','latest','recommended','following') NOT NULL,
	`score` decimal(10,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `feed_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_synthesis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`summary` text,
	`keyPoints` text,
	`consensus` text,
	`disagreements` text,
	`qualityScore` decimal(3,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_synthesis_id` PRIMARY KEY(`id`),
	CONSTRAINT `knowledge_synthesis_questionId_unique` UNIQUE(`questionId`)
);
--> statement-breakpoint
CREATE TABLE `model_expertise_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`aiModelId` int NOT NULL,
	`topicId` int NOT NULL,
	`expertiseScore` decimal(3,2) DEFAULT '0.50',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_expertise_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('new_response','synthesis_complete','reputation_gained','achievement_unlocked','trending_question','follow','admin_message') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`relatedQuestionId` int,
	`relatedAnswerId` int,
	`relatedModelId` int,
	`isRead` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `question_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`topicId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`text` text NOT NULL,
	`description` text,
	`questionHash` varchar(64),
	`status` enum('pending','active','completed','archived') NOT NULL DEFAULT 'pending',
	`viewCount` int DEFAULT 0,
	`voteCount` int DEFAULT 0,
	`answerCount` int DEFAULT 0,
	`vectorEmbedding` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`parentTopicId` int,
	`questionCount` int NOT NULL DEFAULT 0,
	`answerCount` int NOT NULL DEFAULT 0,
	`trendingScore` decimal(10,2) DEFAULT '0.00',
	`popularity` int DEFAULT 0,
	`vectorEmbedding` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `topics_id` PRIMARY KEY(`id`),
	CONSTRAINT `topics_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `user_follows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`followerId` int NOT NULL,
	`followingId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_follows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_topic_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topicId` int NOT NULL,
	`isFollowing` boolean DEFAULT true,
	`interestScore` decimal(3,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_topic_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `validations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`answerId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int,
	`isCorrect` boolean,
	`feedback` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `validations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vector_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('question','answer','topic') NOT NULL,
	`entityId` int NOT NULL,
	`embedding` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vector_embeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` varchar(512);--> statement-breakpoint
CREATE INDEX `idx_aiach_aiModelId` ON `ai_model_achievements` (`aiModelId`);--> statement-breakpoint
CREATE INDEX `idx_aimodels_enabled` ON `ai_models` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_aimodels_provider` ON `ai_models` (`provider`);--> statement-breakpoint
CREATE INDEX `idx_aireputation_aiModelId` ON `ai_reputation` (`aiModelId`);--> statement-breakpoint
CREATE INDEX `idx_aireputation_score` ON `ai_reputation` (`reputationScore`);--> statement-breakpoint
CREATE INDEX `idx_airh_aiModelId` ON `ai_reputation_history` (`aiModelId`);--> statement-breakpoint
CREATE INDEX `idx_airh_recordedAt` ON `ai_reputation_history` (`recordedAt`);--> statement-breakpoint
CREATE INDEX `idx_answers_questionId` ON `answers` (`questionId`);--> statement-breakpoint
CREATE INDEX `idx_answers_aiModelId` ON `answers` (`aiModelId`);--> statement-breakpoint
CREATE INDEX `idx_answers_createdAt` ON `answers` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_dd_questionId` ON `debate_diagrams` (`questionId`);--> statement-breakpoint
CREATE INDEX `idx_fi_userId` ON `feed_items` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_fi_feedType` ON `feed_items` (`feedType`);--> statement-breakpoint
CREATE INDEX `idx_fi_score` ON `feed_items` (`score`);--> statement-breakpoint
CREATE INDEX `idx_ks_questionId` ON `knowledge_synthesis` (`questionId`);--> statement-breakpoint
CREATE INDEX `idx_met_aiModelId` ON `model_expertise_topics` (`aiModelId`);--> statement-breakpoint
CREATE INDEX `idx_met_topicId` ON `model_expertise_topics` (`topicId`);--> statement-breakpoint
CREATE INDEX `idx_notif_userId` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_notif_type` ON `notifications` (`type`);--> statement-breakpoint
CREATE INDEX `idx_notif_isRead` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `idx_qt_questionId` ON `question_topics` (`questionId`);--> statement-breakpoint
CREATE INDEX `idx_qt_topicId` ON `question_topics` (`topicId`);--> statement-breakpoint
CREATE INDEX `idx_questions_userId` ON `questions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_questions_status` ON `questions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_questions_hash` ON `questions` (`questionHash`);--> statement-breakpoint
CREATE INDEX `idx_questions_createdAt` ON `questions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_topics_name` ON `topics` (`name`);--> statement-breakpoint
CREATE INDEX `idx_topics_trending` ON `topics` (`trendingScore`);--> statement-breakpoint
CREATE INDEX `idx_uf_followerId` ON `user_follows` (`followerId`);--> statement-breakpoint
CREATE INDEX `idx_uf_followingId` ON `user_follows` (`followingId`);--> statement-breakpoint
CREATE INDEX `idx_utp_userId` ON `user_topic_preferences` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_utp_topicId` ON `user_topic_preferences` (`topicId`);--> statement-breakpoint
CREATE INDEX `idx_validations_answerId` ON `validations` (`answerId`);--> statement-breakpoint
CREATE INDEX `idx_validations_userId` ON `validations` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_ve_entityType` ON `vector_embeddings` (`entityType`);--> statement-breakpoint
CREATE INDEX `idx_ve_entityId` ON `vector_embeddings` (`entityId`);--> statement-breakpoint
CREATE INDEX `idx_users_openId` ON `users` (`openId`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);