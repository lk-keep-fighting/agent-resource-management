-- Agent Skill System Database Schema

CREATE DATABASE IF NOT EXISTS agent_skill_system;
USE agent_skill_system;

-- Users table
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  api_key_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_api_key_hash (api_key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Skills table
CREATE TABLE skills (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  license VARCHAR(64),
  compatibility TEXT,
  metadata JSON,
  allowed_tools JSON,
  
  file_size BIGINT NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  
  published_at TIMESTAMP NOT NULL,
  published_by VARCHAR(36) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  download_count INT DEFAULT 0,
  status ENUM('active', 'draft', 'deleted') DEFAULT 'active',
  
  INDEX idx_name (name),
  INDEX idx_status (status),
  INDEX idx_published_by (published_by),
  INDEX idx_published_at (published_at),
  FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Skill files storage path: data/skills/{skill_name}/{file_name}
