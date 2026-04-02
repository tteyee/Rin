CREATE TABLE `categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);
--> statement-breakpoint
ALTER TABLE `feeds` ADD COLUMN `category_id` integer REFERENCES `categories`(`id`);
--> statement-breakpoint
UPDATE `info` SET `value` = '10' WHERE `key` = 'migration_version';
