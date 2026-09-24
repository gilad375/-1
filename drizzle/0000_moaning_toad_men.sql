CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`photo_key` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_members_name_unique` ON `family_members` (`name`);--> statement-breakpoint
CREATE TABLE `recipe_images` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`object_key` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_images_object_key_unique` ON `recipe_images` (`object_key`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`author` text DEFAULT 'המשפחה' NOT NULL,
	`category` text DEFAULT 'ארוחות ערב' NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`servings` text DEFAULT '' NOT NULL,
	`difficulty` text DEFAULT 'קל' NOT NULL,
	`story` text DEFAULT '' NOT NULL,
	`ingredients` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
