ALTER TABLE `recipes` ADD `origin` text DEFAULT '' NOT NULL;
CREATE TABLE `recipe_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
CREATE INDEX `idx_recipe_comments_recipe_created` ON `recipe_comments` (`recipe_id`,`created_at`);
