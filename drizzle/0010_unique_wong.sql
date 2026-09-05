CREATE TABLE `billing_accounts` (
	`owner_email` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan_id` text,
	`billing_cycle` text,
	`status` text DEFAULT 'inactive' NOT NULL,
	`current_period_start` text,
	`current_period_end` text,
	`next_credit_renewal_at` text,
	`cancel_at_period_end` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_accounts_stripe_customer_id_unique` ON `billing_accounts` (`stripe_customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_accounts_stripe_subscription_id_unique` ON `billing_accounts` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `billing_accounts_subscription_idx` ON `billing_accounts` (`stripe_subscription_id`);--> statement-breakpoint
CREATE TABLE `credit_accounts` (
	`owner_email` text PRIMARY KEY NOT NULL,
	`included_balance` integer DEFAULT 0 NOT NULL,
	`topup_balance` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`amount` integer NOT NULL,
	`included_amount` integer DEFAULT 0 NOT NULL,
	`topup_amount` integer DEFAULT 0 NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`operation_key` text NOT NULL,
	`reference_id` text,
	`description` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`settled_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_ledger_operation_key_unique` ON `credit_ledger` (`operation_key`);--> statement-breakpoint
CREATE INDEX `credit_ledger_owner_created_idx` ON `credit_ledger` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`processed_at` text,
	`error` text
);
