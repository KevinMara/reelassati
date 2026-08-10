CREATE TABLE `support_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_email` text NOT NULL,
	`requester_name` text,
	`authenticated_owner_email` text,
	`category` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`conversation_json` text DEFAULT '[]' NOT NULL,
	`ai_summary` text,
	`status` text DEFAULT 'open' NOT NULL,
	`email_status` text DEFAULT 'pending' NOT NULL,
	`provider_message_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_tickets_email_created_idx` ON `support_tickets` (`requester_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_tickets_status_created_idx` ON `support_tickets` (`status`,`created_at`);