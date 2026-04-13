CREATE TABLE IF NOT EXISTS `categories` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL UNIQUE,
  `slug` text NOT NULL UNIQUE,
  `description` text,
  `uid` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`uid`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
ALTER TABLE `feeds` ADD COLUMN `category_id` integer REFERENCES `categories`(`id`);
--> statement-breakpoint
UPDATE `info` SET `value` = '10' WHERE `key` = 'migration_version';
