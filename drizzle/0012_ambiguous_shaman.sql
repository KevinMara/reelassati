CREATE TABLE `social_analytics_snapshots` (
	`owner_key` text NOT NULL,
	`day` text NOT NULL,
	`payload` text NOT NULL,
	`synced_at` text NOT NULL,
	PRIMARY KEY(`owner_key`, `day`)
);
