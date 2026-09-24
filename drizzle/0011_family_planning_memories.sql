CREATE TABLE `family_meal_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`day_key` text NOT NULL,
	`recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
	`author_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_family_meal_plans_day` ON `family_meal_plans` (`day_key`);
--> statement-breakpoint
CREATE TABLE `family_polls` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`options_json` text NOT NULL,
	`votes_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`event_date` text NOT NULL,
	`recipe_id` text REFERENCES `recipes`(`id`) ON DELETE SET NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_family_events_date` ON `family_events` (`event_date`);
--> statement-breakpoint
CREATE TABLE `family_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`author_name` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`image_key` text,
	`audio_key` text,
	`video_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_family_memories_created` ON `family_memories` (`created_at`);
