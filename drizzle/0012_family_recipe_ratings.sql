CREATE TABLE `recipe_ratings` (`id` text PRIMARY KEY NOT NULL, `recipe_id` text NOT NULL REFERENCES `recipes`(`id`) ON DELETE CASCADE, `member_name` text NOT NULL, `rating` integer NOT NULL CHECK (`rating` BETWEEN 1 AND 5), `created_at` integer NOT NULL, UNIQUE (`recipe_id`,`member_name`));
CREATE INDEX `idx_recipe_ratings_recipe` ON `recipe_ratings` (`recipe_id`);
