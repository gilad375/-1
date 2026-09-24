CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'אנונימי' NOT NULL,
	`type` text DEFAULT 'משוב' NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
