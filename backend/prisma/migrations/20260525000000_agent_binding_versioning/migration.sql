-- Migration: Agent Binding Versioning
-- Description: Modify agent_skills and agent_knowledge_bindings tables for versioned bindings

-- Rename agent_skills to agent_skill_bindings if it exists
RENAME TABLE `agent_skills` TO `agent_skill_bindings`;

-- Add version and deleted_at columns to agent_skill_bindings if they don't exist
SET @column_exists = 0;
SELECT COUNT(*) INTO @column_exists FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_skill_bindings' AND COLUMN_NAME = 'version';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE `agent_skill_bindings` ADD COLUMN `version` VARCHAR(255) NOT NULL DEFAULT ''1.0.0'' AFTER `skillId`', 'SELECT ''Column version already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists = 0;
SELECT COUNT(*) INTO @column_exists FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_skill_bindings' AND COLUMN_NAME = 'deleted_at';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE `agent_skill_bindings` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL AFTER `config`', 'SELECT ''Column deleted_at already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists = 0;
SELECT COUNT(*) INTO @column_exists FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_skill_bindings' AND COLUMN_NAME = 'created_at';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE `agent_skill_bindings` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `deleted_at`', 'SELECT ''Column created_at already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop existing constraints and primary key
ALTER TABLE `agent_skill_bindings` DROP PRIMARY KEY;

-- Add new primary key
ALTER TABLE `agent_skill_bindings` ADD PRIMARY KEY (`id`);

-- Add unique constraint for (agentId, skillId, version) - ignore if exists
SET @constraint_exists = 0;
SELECT COUNT(*) INTO @constraint_exists FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_skill_bindings' AND INDEX_NAME = 'uq_agent_skill_version';
SET @sql = IF(@constraint_exists = 0, 'ALTER TABLE `agent_skill_bindings` ADD CONSTRAINT `uq_agent_skill_version` UNIQUE (`agentId`, `skillId`, `version`)', 'SELECT ''Constraint uq_agent_skill_version already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add indexes if not exists
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_skill_bindings' AND INDEX_NAME = 'idx_skill_binding_agent';
SET @sql = IF(@index_exists = 0, 'ALTER TABLE `agent_skill_bindings` ADD INDEX `idx_skill_binding_agent` (`agentId`)', 'SELECT ''Index idx_skill_binding_agent already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_skill_bindings' AND INDEX_NAME = 'idx_skill_binding_skill';
SET @sql = IF(@index_exists = 0, 'ALTER TABLE `agent_skill_bindings` ADD INDEX `idx_skill_binding_skill` (`skillId`)', 'SELECT ''Index idx_skill_binding_skill already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Check if agent_knowledge_bindings table exists (may be named differently)
SET @table_exists = 0;
SELECT COUNT(*) INTO @table_exists FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_knowledge_bindings';
SET @sql = IF(@table_exists = 0,
  'CREATE TABLE `agent_knowledge_bindings` (
    `id` VARCHAR(191) NOT NULL DEFAULT (uuid()),
    `agentId` VARCHAR(191) NOT NULL,
    `knowledgeId` VARCHAR(191) NOT NULL,
    `version` VARCHAR(255) NOT NULL DEFAULT ''1.0.0'',
    `retrievalConfig` JSON NULL,
    `deleted_at` DATETIME NULL DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uq_agent_knowledge_version` (`agentId`, `knowledgeId`, `version`),
    INDEX `idx_knowledge_binding_agent` (`agentId`),
    INDEX `idx_knowledge_binding_knowledge` (`knowledgeId`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  'SELECT ''Table agent_knowledge_bindings already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
