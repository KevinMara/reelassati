CREATE TABLE `trend_research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`query_hash` text NOT NULL,
	`scope_json` text NOT NULL,
	`payload_json` text NOT NULL,
	`credit_cost` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trend_research_owner_created_idx` ON `trend_research_runs` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `trend_research_owner_query_idx` ON `trend_research_runs` (`owner_email`,`query_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `trend_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_key` text NOT NULL,
	`payload_json` text NOT NULL,
	`generated_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trend_snapshots_scope_expires_idx` ON `trend_snapshots` (`scope_key`,`expires_at`);