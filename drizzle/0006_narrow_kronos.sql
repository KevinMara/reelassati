DROP INDEX `ai_provenance_entity_idx`;--> statement-breakpoint
ALTER TABLE `ai_provenance_records` ADD `signing_key_id` text NOT NULL DEFAULT 'legacy-v1';--> statement-breakpoint
CREATE UNIQUE INDEX `ai_provenance_owner_entity_unique` ON `ai_provenance_records` (`owner_email`,`entity_type`,`entity_id`);--> statement-breakpoint
ALTER TABLE `operator_compliance` ADD `first_eu_availability_date` text;
