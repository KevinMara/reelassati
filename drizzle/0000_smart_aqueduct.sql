CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`r2_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_r2_key_unique` ON `assets` (`r2_key`);--> statement-breakpoint
CREATE INDEX `assets_owner_created_idx` ON `assets` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`provider_job_id` text,
	`project_id` text,
	`prompt` text,
	`status` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`result_asset_id` text,
	`error` text,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generation_jobs_owner_created_idx` ON `generation_jobs` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `workspace_state` (
	`owner_email` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `zernio_profiles` (
	`owner_email` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `zernio_profiles_profile_id_unique` ON `zernio_profiles` (`profile_id`);