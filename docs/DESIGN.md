# Agent Skill 管理系统 - 设计文档

## 1. 概述

### 1.1 系统定位

企业级 Agent 技能分发平台，作为 Agent 获取 Skill 的唯一渠道。

### 1.2 核心功能

| 功能 | 说明 |
|------|------|
| 上传 | 上传本地 Skill (ZIP 包) |
| 获取 | Agent 通过 CLI 下载 Skill |
| 分发 | Skill 市场浏览与搜索 |
| 管理 | Web 后台管理 Skill |
| 迭代 | 支持 Agent 与 Skill/Knowledge 的版本化绑定与同步 |

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────┐
│                     CLI (arm)                    │
│   Bun + TypeScript                               │
│   登录 → 浏览 → 下载/上传 → 同步                  │
└──────────────────────┬──────────────────────────┘
                        │ HTTP/REST
         ┌──────────────▼──────────────┐
         │     Next.js Backend         │
         │   App Router + API Routes   │
         │  ┌──────────────────────┐  │
         │  │   Skill Registry     │  │
         │  │   Knowledge Store    │  │
         │  │   Agent Manager      │  │
         │  └──────────────────────┘  │
         └──────────────┬─────────────┘
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
    ┌───────────┐ ┌───────────┐ ┌───────────┐
    │   MySQL   │ │   MySQL   │ │ data/     │
    │ Skill元数据│ │Knowledge  │ │ skills/   │
    └───────────┘ └───────────┘ │ knowledges│
                                └───────────┘
```

---

## 3. 技术栈

| 组件 | 技术 |
|------|------|
| CLI | Bun + TypeScript |
| Backend | Next.js 14 (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| 数据库 | MySQL + Prisma ORM |
| 文件存储 | data/skills/ (本地) |
| 验证 | Zod |

---

## 4. 设计原则

### 4.1 开闭原则 (Open-Closed Principle)

```
Agent 管理遵循开闭原则:

对扩展开放:
  - Skill/Knowledge 绑定通过新增版本扩展，不修改旧绑定

对修改关闭:
  - Agent 元信息 (name, description, prompt) 可直接编辑
  - Skill/Knowledge 绑定记录不可修改，只可新增或软删除
```

### 4.2 版本化绑定模型

```
┌─────────────────────────────────────────────────────────┐
│                      Agent                              │
│  - name (不可变)                                        │
│  - description (可编辑)                                 │
│  - prompt (可编辑)                                       │
│  - avatar (可编辑)                                      │
│  - status: draft | active | archived                    │
└─────────────────────────────────────────────────────────┘
                          │
                          │ 持有多个版本快照 (不可变)
                          ▼
┌─────────────────────────────────────────────────────────┐
│              AgentSkillBinding                           │
│  - agentId                                              │
│  - skillId                                              │
│  - version: "1.0.0" → "1.0.1" → "1.1.0" (只增不删)    │
│  - config: { ... }                                      │
│  - deletedAt: null | timestamp (软删除)                  │
│  - createdAt                                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│            AgentKnowledgeBinding                         │
│  - agentId                                              │
│  - knowledgeId                                          │
│  - version: "1.0.0" (只增不删)                         │
│  - retrievalConfig: { topK, similarityThreshold }       │
│  - deletedAt: null | timestamp (软删除)                  │
│  - createdAt                                            │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 数据模型

### 5.1 Skill

```typescript
interface Skill {
  id: string;                // UUID
  name: string;             // 唯一名称
  description: string;       // 描述
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];

  // 文件信息
  fileSize: number;         // ZIP 包大小
  fileHash: string;         // SHA256 哈希

  // 发布信息
  publishedAt: string;       // ISO timestamp
  publishedBy: string;       // 发布者 userId
  updatedAt: string;

  // 统计
  downloadCount: number;

  // 状态
  status: 'active' | 'draft' | 'deleted';
}
```

### 5.2 Knowledge

```typescript
interface Knowledge {
  id: string;               // UUID
  name: string;             // 唯一名称
  description?: string;
  content?: string;         // Markdown 内容

  createdAt: string;
  updatedAt: string;
  createdBy: string;        // 创建者 userId
}
```

### 5.3 Agent

```typescript
interface Agent {
  id: string;               // UUID
  name: string;             // 唯一名称
  description: string;
  prompt: string;           // System Prompt
  avatar?: string;
  version: string;          // SemVer
  status: 'draft' | 'active';

  createdAt: string;
  updatedAt: string;
  createdBy: string;

  // 动态绑定 (通过 AgentSkillBinding / AgentKnowledgeBinding)
  skills: SkillBinding[];
  knowledges: KnowledgeBinding[];
}

interface SkillBinding {
  id: string;
  skillId: string;
  version: string;          // 绑定时的 Skill 版本
  skill?: Skill;           // 关联的 Skill 信息
  config?: Record<string, unknown>;
  createdAt: string;
}

interface KnowledgeBinding {
  id: string;
  knowledgeId: string;
  version: string;          // 绑定时的 Knowledge 版本
  knowledge?: Knowledge;
  retrievalConfig?: {
    topK?: number;
    similarityThreshold?: number;
  };
  createdAt: string;
}
```

### 5.4 AgentSkillBinding

```typescript
interface AgentSkillBinding {
  id: string;              // UUID
  agentId: string;
  skillId: string;
  version: string;         // 版本号 (SemVer)
  config?: Record<string, unknown>;
  deletedAt?: string;      // 软删除时间
  createdAt: string;
}
```

### 5.5 AgentKnowledgeBinding

```typescript
interface AgentKnowledgeBinding {
  id: string;              // UUID
  agentId: string;
  knowledgeId: string;
  version: string;         // 版本号 (SemVer)
  retrievalConfig?: {
    topK?: number;
    similarityThreshold?: number;
  };
  deletedAt?: string;      // 软删除时间
  createdAt: string;
}
```

### 5.6 User

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  apiKey: string;          // API Key (哈希存储)
  role: 'USER' | 'ADMIN';
  createdAt: string;
}
```

---

## 6. API 规范

### 6.1 认证

| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/v1/auth/login` | 登录 (验证 API Key) |
| GET | `/api/v1/auth/me` | 获取当前用户 |

### 6.2 Skills

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/skills` | 列表/搜索 Skills |
| GET | `/api/v1/skills/:name` | 获取 Skill 详情 |
| GET | `/api/v1/skills/:name/download` | 下载 Skill ZIP |
| POST | `/api/v1/skills` | 上传/发布 Skill |
| DELETE | `/api/v1/skills/:name` | 删除 Skill |
| GET | `/api/v1/users/me/skills` | 我的发布列表 |

### 6.3 Knowledges

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/knowledges` | 列表/搜索 Knowledges |
| GET | `/api/v1/knowledges/:id` | 获取 Knowledge 详情 |
| POST | `/api/v1/knowledges` | 上传/创建 Knowledge |
| DELETE | `/api/v1/knowledges/:id` | 删除 Knowledge |
| GET | `/api/v1/users/me/knowledges` | 我的 Knowledge 列表 |

### 6.4 Agents

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/agents` | 列表/搜索 Agents |
| GET | `/api/v1/agents/:id` | 获取 Agent 详情 (含绑定信息) |
| POST | `/api/v1/agents` | 创建 Agent |
| PUT | `/api/v1/agents/:id` | 更新 Agent 元信息 |
| DELETE | `/api/v1/agents/:id` | 删除 Agent |
| GET | `/api/v1/agents/:id/download` | 下载 Agent 打包 |
| GET | `/api/v1/agents/:id/bindings/history` | 获取绑定历史 |

### 6.5 Agent 绑定

| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/v1/agents/:id/skills` | 绑定 Skill (版本化) |
| DELETE | `/api/v1/agents/:id/skills?skillId=xxx&version=yyy` | 解绑 Skill |
| POST | `/api/v1/agents/:id/knowledges` | 绑定 Knowledge (版本化) |
| DELETE | `/api/v1/agents/:id/knowledges?knowledgeId=xxx&version=yyy` | 解绑 Knowledge |

**版本号说明**:
- `version` 参数可选，缺省时自动分配新版本 (patch + 1)
- 解绑时不传 `version` 则解绑所有版本

### 6.6 响应格式

```typescript
interface ApiResponse<T> {
  ok: boolean;   // true/false
  data: T;       // 返回数据
  msg: string;   // 描述消息 (ok: "操作成功", fail: "错误原因")
}
```

### 6.7 健康检查

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/health` | 健康检查 |

---

## 7. CLI 命令

### 7.1 认证

```bash
arm login <server-url> <api-key>   # 登录 (指定服务端地址)
arm logout                          # 登出
```

### 7.2 Skill 命令

```bash
arm skill ls                # 列出所有 Skill
arm skill search <keyword>  # 搜索 Skill
arm skill info <name>       # 查看 Skill 详情
arm skill download <name>   # 下载 Skill 到本地 (ZIP)
arm skill upload <path>     # 上传本地 Skill (ZIP)
arm skill my                # 我的发布列表
arm skill delete <name>     # 删除已发布 Skill
arm skill validate <path>   # 验证本地 Skill 格式
```

### 7.3 Knowledge 命令

```bash
arm knowledge ls                    # 列出所有 Knowledge
arm knowledge search <keyword>      # 搜索 Knowledge
arm knowledge info <name>           # 查看 Knowledge 详情
arm knowledge download <name>       # 下载 Knowledge
arm knowledge upload <path>         # 上传本地 Knowledge (.md)
arm knowledge my                    # 我的 Knowledge 列表
arm knowledge delete <name>         # 删除 Knowledge
```

### 7.4 Agent 命令

```bash
# 基础 CRUD
arm agent ls                        # 列出所有 Agent
arm agent search <keyword>          # 搜索 Agent
arm agent info <name>               # 查看 Agent 详情
arm agent download <name> [dir]     # 下载 Agent 到本地
arm agent create <name>             # 创建 Agent
arm agent create --from=<folder>    # 从本地文件夹创建 Agent
arm agent update <id>               # 更新 Agent 元信息
arm agent delete <id>                # 删除 Agent

# 绑定管理 (版本化)
arm agent bind <id> --skill=<skillId>       # 绑定 Skill (版本自动分配)
arm agent bind <id> --knowledge=<id>        # 绑定 Knowledge (版本自动分配)
arm agent unbind <id> --skill=<skillId>     # 解绑 Skill (所有版本)
arm agent unbind <id> --skill=<skillId> --version=1.0.0  # 解绑指定版本

# 迭代同步
arm agent sync <folder>             # 同步本地文件夹到云端 Agent
arm agent sync <folder> --dry-run   # 预览变更 (不执行)
```

---

## 8. Skill 规范

### 8.1 目录结构

符合 [AgentSkills Spec](https://agentskills.io/specification)：

```
skill-name/
├── SKILL.md          # 必填: metadata + instructions
├── scripts/          # 可选: 可执行脚本
├── references/       # 可选: 文档
├── assets/           # 可选: 静态资源
└── ...               # 其他文件/目录
```

### 8.2 SKILL.md 格式

```yaml
---
name: skill-name                    # 必填, 1-64字符, 小写+连字符
description: 描述...                # 必填, 1-1024字符
version: "1.0.0"                   # 可选, 默认 1.0.0
license: MIT                        # 可选
compatibility: 环境需求...          # 可选
metadata:                           # 可选
  author: xxx
allowed-tools: Bash(git:*) Read    # 可选
---

# Instructions for the agent
```

### 8.3 ZIP 包规范

```
ZIP 包名 = Skill 名称.zip
例如: pdf-tool.zip

解压后目录结构:
data/skills/
└── pdf-tool/           # 同名文件夹
    ├── SKILL.md
    ├── scripts/
    ├── references/
    └── assets/
```

**关键规则**:
- ZIP 包内容直接是 Skill 目录内容（无顶层目录）
- 解压时自动创建同名文件夹
- 同一 Skill 可多次下载覆盖

---

## 9. 项目结构

```
agent-resource-management/
├── cli/                        # Bun CLI
│   ├── src/
│   │   ├── cmd/
│   │   │   ├── auth.ts
│   │   │   ├── skill.ts
│   │   │   ├── knowledge.ts
│   │   │   ├── agent.ts        # Agent 命令 + sync
│   │   │   └── server.ts
│   │   ├── lib/
│   │   │   ├── client.ts       # API 客户端
│   │   │   ├── storage.ts      # 本地存储
│   │   │   ├── validate.ts     # 验证逻辑
│   │   │   ├── formatter.ts
│   │   │   └── output.ts
│   │   └── main.ts
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                     # Next.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/         # 认证页面
│   │   │   ├── (dashboard)/    # 管理后台
│   │   │   │   ├── agents/     # Agent 管理
│   │   │   │   ├── skills/     # Skill 市场
│   │   │   │   ├── knowledges/ # Knowledge
│   │   │   │   └── settings/    # 设置
│   │   │   └── api/
│   │   │       └── v1/         # API Routes
│   │   │           ├── auth/
│   │   │           ├── skills/
│   │   │           ├── knowledges/
│   │   │           └── agents/
│   │   │               └── [id]/
│   │   │                   ├── skills/
│   │   │                   ├── knowledges/
│   │   │                   └── bindings/
│   │   ├── components/
│   │   │   └── ui/             # shadcn/ui
│   │   └── lib/
│   │       ├── db.ts
│   │       └── auth.ts
│   └── prisma/
│       └── schema.prisma
│
├── pkg/                        # 共享类型
│   └── types/
│       └── skill.ts
│
└── docs/
    ├── DESIGN.md               # 本文档
    ├── agent-iteration-design.md # Agent 迭代更新设计
    └── CHANGE_LOG_v2.2.0.md   # 变更记录
```

---

## 10. 数据库 Schema

### 10.1 users 表

```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  sso_user_id VARCHAR(255) UNIQUE,
  feishu_union_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  api_key_hash VARCHAR(255) UNIQUE,
  role VARCHAR(36) DEFAULT 'USER',
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_api_key_hash (api_key_hash),
  INDEX idx_sso_user_id (sso_user_id)
);
```

### 10.2 skills 表

```sql
CREATE TABLE skills (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL,
  description VARCHAR(1024) NOT NULL,
  license VARCHAR(255),
  compatibility VARCHAR(255),
  metadata JSON,
  allowed_tools JSON,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_hash VARCHAR(255) NOT NULL,
  published_at TIMESTAMP,
  published_by VARCHAR(36) NOT NULL,
  updated_at TIMESTAMP,
  download_count INT DEFAULT 0,
  status ENUM('active', 'draft', 'deleted') DEFAULT 'active',
  INDEX idx_name (name),
  INDEX idx_status (status),
  INDEX idx_published_by (published_by),
  FOREIGN KEY (published_by) REFERENCES users(id)
);
```

### 10.3 knowledges 表

```sql
CREATE TABLE knowledges (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL,
  description VARCHAR(1024),
  content LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  created_by VARCHAR(36) NOT NULL,
  INDEX idx_name (name),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 10.4 agents 表

```sql
CREATE TABLE agents (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description VARCHAR(512) NOT NULL,
  prompt TEXT NOT NULL,
  avatar VARCHAR(255),
  version VARCHAR(36) DEFAULT '1.0.0',
  status ENUM('draft', 'active') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  created_by VARCHAR(36) NOT NULL,
  INDEX idx_name (name),
  INDEX idx_created_by (created_by),
  INDEX idx_agent_version (version),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 10.5 agent_skill_bindings 表 (版本化绑定)

```sql
CREATE TABLE agent_skill_bindings (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  agent_id VARCHAR(36) NOT NULL,
  skill_id VARCHAR(36) NOT NULL,
  version VARCHAR(255) NOT NULL DEFAULT '1.0.0',
  config JSON,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_skill_binding_agent (agent_id),
  INDEX idx_skill_binding_skill (skill_id),
  UNIQUE INDEX uq_agent_skill_version (agent_id, skill_id, version),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);
```

### 10.6 agent_knowledge_bindings 表 (版本化绑定)

```sql
CREATE TABLE agent_knowledge_bindings (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  agent_id VARCHAR(36) NOT NULL,
  knowledge_id VARCHAR(36) NOT NULL,
  version VARCHAR(255) NOT NULL DEFAULT '1.0.0',
  retrieval_config JSON,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_knowledge_binding_agent (agent_id),
  INDEX idx_knowledge_binding_knowledge (knowledge_id),
  UNIQUE INDEX uq_agent_knowledge_version (agent_id, knowledge_id, version),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (knowledge_id) REFERENCES knowledges(id) ON DELETE CASCADE
);
```

---

## 11. 实现状态

### Phase 1: 基础架构 ✅
- [x] 1.1 创建项目目录结构
- [x] 1.2 定义共享类型 (pkg/types)
- [x] 1.3 设计 MySQL 表结构 (Prisma Schema)
- [x] 1.4 配置数据库连接

### Phase 2: Backend API ✅
- [x] 2.1 实现 API 响应封装
- [x] 2.2 实现 API Key 认证中间件
- [x] 2.3 POST /api/v1/auth/login 登录接口
- [x] 2.4 GET /api/v1/auth/me 获取当前用户
- [x] 2.5 GET /api/v1/skills 列表/搜索 Skills
- [x] 2.6 GET /api/v1/skills/:name 获取 Skill 详情
- [x] 2.7 GET /api/v1/skills/:name/download 下载 Skill ZIP
- [x] 2.8 POST /api/v1/skills 上传/发布 Skill
- [x] 2.9 DELETE /api/v1/skills/:name 删除 Skill
- [x] 2.10 GET /api/v1/users/me/skills 我的发布列表
- [x] 2.11 GET /api/v1/health 健康检查

### Phase 3: Web UI 🚧
- [x] 3.1 搭建 Next.js + shadcn/ui 项目
- [ ] 3.2 登录页 (API Key 登录)
- [ ] 3.3 布局 (侧边栏 + 导航)
- [ ] 3.4 Skill 市场列表页
- [ ] 3.5 Skill 详情页 (下载按钮)
- [ ] 3.6 我的发布列表页
- [ ] 3.7 Skill 上传页面

### Phase 4: CLI (Bun) ✅
- [x] 4.1 初始化 Bun 项目
- [x] 4.2 实现 CLI 框架 (命令解析)
- [x] 4.3 arm login 登录命令
- [x] 4.4 arm logout 登出命令
- [x] 4.5 arm skill ls 列出 Skills
- [x] 4.6 arm skill search 搜索 Skills
- [x] 4.7 arm skill info 查看详情
- [x] 4.8 arm skill download 下载并解压
- [x] 4.9 arm skill upload 上传 ZIP
- [x] 4.10 arm skill my 我的发布
- [x] 4.11 arm skill delete 删除
- [x] 4.12 arm skill validate 验证格式

### Phase 5: Agent 管理 (v2.2.0) ✅
- [x] 5.1 Agent 数据模型
- [x] 5.2 Agent CRUD API
- [x] 5.3 Agent 绑定 API (版本化)
- [x] 5.4 arm agent 命令
- [x] 5.5 arm agent sync 同步命令
- [x] 5.6 绑定历史查询 API

### Phase 6: 完善
- [ ] 6.1 批量操作接口
- [ ] 6.2 Webhook 通知机制
- [ ] 6.3 变更日志审计
- [ ] 6.4 回滚功能
