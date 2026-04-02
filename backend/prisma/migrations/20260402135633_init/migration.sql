-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `api_key_hash` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_api_key_hash_key`(`api_key_hash`),
    INDEX `idx_email`(`email`),
    INDEX `idx_api_key_hash`(`api_key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skills` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `license` VARCHAR(191) NULL,
    `compatibility` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `allowed_tools` JSON NULL,
    `file_size` BIGINT NOT NULL,
    `file_hash` VARCHAR(191) NOT NULL,
    `published_at` DATETIME(3) NOT NULL,
    `published_by` VARCHAR(191) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `download_count` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('active', 'draft', 'deleted') NOT NULL DEFAULT 'active',

    UNIQUE INDEX `skills_name_key`(`name`),
    INDEX `idx_name`(`name`),
    INDEX `idx_status`(`status`),
    INDEX `idx_published_by`(`published_by`),
    INDEX `idx_published_at`(`published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `skills` ADD CONSTRAINT `skills_published_by_fkey` FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
