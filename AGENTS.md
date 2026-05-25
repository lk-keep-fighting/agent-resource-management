# Agent Resource Management (ARM)

> 让智能体的每一次工作都有价值，每一次经验都不被丢失。

## 系统目标

ARM 是一个企业级 **Agent 资源管理系统**，借鉴 HRM 思想，对 AI Agent 的 Skill（技能）和 Knowledge（知识）进行全生命周期管理。

**核心价值**：
- Skill 复用：一次上传，多次使用
- 版本化绑定：Agent 与 Skill/Knowledge 的绑定可追溯、可回滚
- 统一管理：通过 CLI/Web/API 统一管理 Agent 团队

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI (arm)                             │
│              Bun + TypeScript                                │
│         login → ls → upload/download → sync                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Next.js Backend                            │
│                  App Router + API Routes                     │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ Skill       │  │ Knowledge    │  │ Agent            │    │
│  │ Registry    │  │ Store        │  │ Manager          │    │
│  └─────────────┘  └──────────────┘  └──────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────────┐
    │  MySQL   │    │  MySQL   │    │ data/        │
    │  Skills  │    │  Knowledges│   │ skills/     │
    │  Bindings│    │  Bindings │   │ knowledges/ │
    └──────────┘    └──────────┘    └──────────────┘
```

---

## 代码结构

```
agent-resource-management/
│
├── backend/                    # Next.js 主服务
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/v1/       # REST API 路由
│   │   │   │   ├── auth/     # 认证 (login, me)
│   │   │   │   ├── agents/   # Agent CRUD + 绑定
│   │   │   │   ├── skills/   # Skill 管理
│   │   │   │   ├── knowledges/  # Knowledge 管理
│   │   │   │   └── users/    # 用户资源
│   │   │   └── (dashboard)/  # Web 管理后台
│   │   └── lib/              # 工具函数
│   │       ├── db.ts         # Prisma Client
│   │       ├── auth.ts       # 认证逻辑
│   │       ├── api-response.ts  # 响应封装
│   │       └── types.ts      # 后端类型
│   ├── prisma/
│   │   └── schema.prisma     # 数据库 Schema
│   └── data/                 # 文件存储
│       ├── skills/           # Skill ZIP 包
│       └── knowledges/       # Knowledge MD 文件
│
├── cli/                       # Bun CLI 工具
│   ├── src/
│   │   ├── main.ts           # 命令入口
│   │   ├── cmd/              # 命令实现
│   │   │   ├── auth.ts       # login/logout
│   │   │   ├── skill.ts      # skill ls/info/upload/...
│   │   │   ├── knowledge.ts  # knowledge ls/info/upload/...
│   │   │   └── agent.ts      # agent CRUD + bind + sync
│   │   └── lib/
│   │       ├── client.ts     # HTTP 客户端
│   │       ├── storage.ts     # 本地配置 (~/.arm/)
│   │       └── output.ts     # JSON/Text 输出
│   └── package.json          # 命令: arm
│
├── pkg/                       # 共享类型包
│   └── types/skill.ts        # TypeScript 类型定义
│
└── docs/                      # 设计文档
    ├── DESIGN.md             # 详细设计文档
    └── *.md                  # 其他文档
```

---

## 模块关系

```
┌─────────────────────────────────────────────────────────────┐
│                        User                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                  ▼
    ┌─────────┐       ┌─────────┐        ┌─────────┐
    │   CLI   │       │   Web   │        │   API   │
    │  (arm)  │       │  UI     │        │  Client │
    └────┬────┘       └────┬────┘        └────┬────┘
         │                 │                  │
         └─────────────────┼──────────────────┘
                           ▼
              ┌────────────────────────┐
              │    Next.js Backend      │
              │    (api/v1/*)           │
              └───────────┬──────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                  ▼
  ┌───────────┐   ┌───────────────┐   ┌─────────────┐
  │   Skill   │   │   Knowledge   │   │   Agent    │
  │ Registry  │   │    Store      │   │  Manager   │
  └─────┬─────┘   └──────┬────────┘   └──────┬──────┘
        │                 │                  │
        └─────────────────┼──────────────────┘
                          ▼
                  ┌──────────────┐
                  │    MySQL     │
                  │  Bindings    │
                  └──────────────┘
```

---

## 核心概念

### Agent
数字化的 AI 工作单元，拥有 `name`、`prompt`、`skills`、`knowledges`。

### Skill
可复用的能力资产，以 ZIP 包形式上传，包含 `SKILL.md` 元信息。

### Knowledge
领域知识，以 Markdown 形式管理，可绑定到 Agent。

### Binding
版本化的关联关系，遵循**开闭原则**：
- ✅ 新增版本
- ❌ 不修改已存在的绑定
- ❌ 不删除（使用 `deletedAt` 软删除）

---

## 快速开始

```bash
# Backend
cd backend && pnpm install && pnpm dev

# CLI
cd cli && bun install && bun run src/main.ts skill ls
```

---

## 详细文档

| 文档 | 说明 |
|------|------|
| `backend/AGENTS.md` | Backend 开发规范 |
| `cli/AGENTS.md` | CLI 开发规范 |
| `docs/DESIGN.md` | 详细设计文档 |
| `README.md` | 项目 README |
