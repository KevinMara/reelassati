CREATE TABLE `trend_refresh_state` (
	`refresh_key` text PRIMARY KEY NOT NULL,
	`lease_expires_at` text NOT NULL,
	`last_started_at` text NOT NULL,
	`last_completed_at` text,
	`last_error` text
);
