-- Add SSO fields to users table
ALTER TABLE `users` ADD COLUMN `sso_user_id` VARCHAR(191) NULL;
ALTER TABLE `users` ADD COLUMN `feishu_union_id` VARCHAR(191) NULL;
ALTER TABLE `users` ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'USER';
ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(191) NULL;

ALTER TABLE `users` ADD UNIQUE INDEX `users_sso_user_id_key`(`sso_user_id`);
ALTER TABLE `users` ADD UNIQUE INDEX `users_feishu_union_id_key`(`feishu_union_id`);
ALTER TABLE `users` ADD INDEX `idx_sso_user_id`(`sso_user_id`);
