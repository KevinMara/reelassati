CREATE TABLE `brand_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brands_owner_idx` ON `brand_workspaces` (`owner_email`);--> statement-breakpoint
ALTER TABLE `assets` ADD `brand_id` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `generation_jobs` ADD `brand_id` text DEFAULT 'default' NOT NULL;