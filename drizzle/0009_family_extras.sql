CREATE TABLE `recipe_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
	`member_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_recipe_approvals_recipe_member` ON `recipe_approvals` (`recipe_id`,`member_name`);
--> statement-breakpoint
CREATE TABLE `family_menus` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`recipe_ids` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_stories` (
	`id` text PRIMARY KEY NOT NULL,
	`author_name` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`image_key` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_family_stories_created` ON `family_stories` (`created_at`);
