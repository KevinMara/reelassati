CREATE TABLE `billing_checkouts` (
	`owner_email` text NOT NULL,
	`kind` text NOT NULL,
	`selection` text NOT NULL,
	`attempt_id` text NOT NULL,
	`session_id` text,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner_email`, `kind`)
);
