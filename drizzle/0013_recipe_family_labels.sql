ALTER TABLE `recipes` ADD `kids_friendly` integer DEFAULT 0 NOT NULL;
ALTER TABLE `recipes` ADD `golden_recipe` integer DEFAULT 0 NOT NULL;
ALTER TABLE `recipes` ADD `secret_ingredient` text DEFAULT '' NOT NULL;
ALTER TABLE `recipes` ADD `equipment` text DEFAULT '' NOT NULL;
ALTER TABLE `recipes` ADD `taste_profile` text DEFAULT '' NOT NULL;
