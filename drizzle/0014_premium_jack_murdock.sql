ALTER TABLE `billing_payment_adjustments` ADD `dispute_id` text;--> statement-breakpoint
ALTER TABLE `billing_payment_adjustments` ADD `dispute_closed` integer DEFAULT 0 NOT NULL;