CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_name` text NOT NULL,
	`recipient_name` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'direct' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_recipient_created` ON `messages` (`recipient_name`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_sender_created` ON `messages` (`sender_name`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
