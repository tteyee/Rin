-- SEO 필드 추가
ALTER TABLE `feeds` ADD COLUMN `meta_title` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `feeds` ADD COLUMN `meta_description` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `feeds` ADD COLUMN `og_image` text NOT NULL DEFAULT '';
--> statement-breakpoint
-- 예약 발행 필드 추가
ALTER TABLE `feeds` ADD COLUMN `scheduled_at` integer;
--> statement-breakpoint
UPDATE `info` SET `value` = '10' WHERE `key` = 'migration_version';
