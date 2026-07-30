CREATE TABLE `referral_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`referral_code` text NOT NULL,
	`referrer_email` text NOT NULL,
	`referred_email` text NOT NULL,
	`credits_awarded` integer DEFAULT 500 NOT NULL,
	`value_cents` integer DEFAULT 500 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_claims_referred_email_unique` ON `referral_claims` (`referred_email`);--> statement-breakpoint
CREATE INDEX `referral_claims_referrer_created_idx` ON `referral_claims` (`referrer_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `referral_codes` (
	`owner_email` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_codes_code_unique` ON `referral_codes` (`code`);