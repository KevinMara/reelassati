CREATE TABLE `publishing_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`request_json` text NOT NULL,
	`provider_response` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitting_at` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `publishing_intents_owner_created_idx` ON `publishing_intents` (`owner_email`,`created_at`);--> statement-breakpoint
ALTER TABLE `generation_jobs` ADD `finalizing_at` text;--> statement-breakpoint
ALTER TABLE `workspace_state` ADD `revision` integer DEFAULT 0 NOT NULL;