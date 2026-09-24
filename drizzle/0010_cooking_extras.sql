ALTER TABLE `recipes` ADD `dedication` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `recipes` ADD `dietary_tag` text DEFAULT 'לא צוין' NOT NULL;
--> statement-breakpoint
CREATE TABLE `recipe_tryouts` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE,
	`member_name` text NOT NULL,
	`image_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recipe_tryouts_recipe_created` ON `recipe_tryouts` (`recipe_id`,`created_at`);
