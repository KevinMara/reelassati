CREATE TABLE `billing_payment_adjustments` (
	`payment_intent` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`credits` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`refunded_cents` integer DEFAULT 0 NOT NULL,
	`disputed_cents` integer DEFAULT 0 NOT NULL,
	`dispute_updated_at` integer DEFAULT 0 NOT NULL,
	`applied_debit` integer DEFAULT 0 NOT NULL
);
