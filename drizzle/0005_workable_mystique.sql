CREATE TABLE `ai_invocations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`purpose` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`policy_version` text NOT NULL,
	`input_sha256` text NOT NULL,
	`output_sha256` text,
	`status` text NOT NULL,
	`error_code` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `ai_invocations_owner_created_idx` ON `ai_invocations` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_provenance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`public_token` text NOT NULL,
	`owner_email` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`origin` text NOT NULL,
	`operation` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`policy_version` text NOT NULL,
	`marking_method` text NOT NULL,
	`marking_status` text NOT NULL,
	`content_sha256` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_provenance_records_public_token_unique` ON `ai_provenance_records` (`public_token`);--> statement-breakpoint
CREATE INDEX `ai_provenance_owner_created_idx` ON `ai_provenance_records` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_provenance_entity_idx` ON `ai_provenance_records` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `ai_provenance_sha256_idx` ON `ai_provenance_records` (`content_sha256`);--> statement-breakpoint
CREATE TABLE `compliance_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`policy_version` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `compliance_events_owner_created_idx` ON `compliance_events` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `operator_compliance` (
	`owner_email` text PRIMARY KEY NOT NULL,
	`legal_name` text,
	`entity_type` text,
	`release_status` text,
	`creative_scope_confirmed_at` text,
	`ai_literacy_acknowledged_at` text,
	`updated_at` text NOT NULL
);
