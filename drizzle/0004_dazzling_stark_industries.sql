PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_referral_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`referral_code` text NOT NULL,
	`referrer_email` text NOT NULL,
	`referred_email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`credits_awarded` integer DEFAULT 0 NOT NULL,
	`value_cents` integer DEFAULT 0 NOT NULL,
	`qualified_at` text,
	`payment_event_id` text,
	`plan_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_referral_claims`("id", "referral_code", "referrer_email", "referred_email", "status", "credits_awarded", "value_cents", "qualified_at", "payment_event_id", "plan_id", "created_at") SELECT "id", "referral_code", "referrer_email", "referred_email", 'pending', 0, 0, NULL, NULL, NULL, "created_at" FROM `referral_claims`;--> statement-breakpoint
DROP TABLE `referral_claims`;--> statement-breakpoint
ALTER TABLE `__new_referral_claims` RENAME TO `referral_claims`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `referral_claims_referred_email_unique` ON `referral_claims` (`referred_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `referral_claims_payment_event_id_unique` ON `referral_claims` (`payment_event_id`);--> statement-breakpoint
CREATE INDEX `referral_claims_referrer_created_idx` ON `referral_claims` (`referrer_email`,`created_at`);
