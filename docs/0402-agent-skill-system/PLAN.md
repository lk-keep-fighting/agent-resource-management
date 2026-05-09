# Agent Skill 管理系统

## 定位

企业级 Agent 技能分发平台，作为 Agent 获取 Skill 的唯一渠道。

## 核心功能

| 功能 | 说明 |
|------|------|
| **上传** | 上传本地 Skill (ZIP 包) |
| **获取** | Agent 通过 CLI 下载 Skill |
| **分发** | Skill 市场浏览与搜索 |
| **管理** | Web 后台管理 Skill |

## 架构

```
┌─────────────────────────────────────────────────┐
│                     CLI (adk)                  │
│   Bun + TypeScript                              │
│   登录 → 浏览 → 下载/上传                        │
└──────────────────────┬──────────────────────────┘
                       │ HTTP/REST
        ┌──────────────▼──────────────┐
        │     Next.js Backend        │
        │   App Router + API Routes  │
        │  ┌──────────────────────┐  │
        │  │   Skill Registry     │  │
        │  └──────────────────────┘  │
        └──────────────┬─────────────┘
                       │
         ┌─────────────▼──────────────┐
         │          MySQL             │
         │    Skill 元数据存储         │
         └─────────────┬──────────────┘
                       │
          ┌─────────────▼──────────────┐
          │    data/skills/            │
          │      Skill ZIP 存储         │
          └────────────────────────────┘
```

## Skill ZIP 包规范

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

## Skill 规范

符合 [AgentSkills Spec](https://agentskills.io/specification)：

```
skill-name/
├── SKILL.md          # 必填: metadata + instructions
├── scripts/          # 可选: 可执行脚本
├── references/       # 可选: 文档
├── assets/           # 可选: 静态资源
└── ...               # 其他文件/目录
```

### SKILL.md 格式

```yaml
---
name: skill-name                    # 必填, 1-64字符, 小写+连字符
description: 描述...                # 必填, 1-1024字符
license: MIT                         # 可选
compatibility: 环境需求...           # 可选
metadata:                           # 可选
  author: xxx
  version: "1.0"
allowed-tools: Bash(git:*) Read      # 可选
---

# Instructions for the agent
```

## 数据模型

```typescript
// Skill 元数据
interface Skill {
  id: string;                // UUID
  name: string;              // 唯一名称
  description: string;      // 描述
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  
  // 文件信息
  fileSize: number;          // ZIP 包大小
  fileHash: string;         // SHA256 哈希
  
  // 发布信息
  publishedAt: string;       // ISO timestamp
  publishedBy: string;      // 发布者 userId
  updatedAt: string;
  
  // 统计
  downloadCount: number;
  
  // 状态
  status: 'active' | 'draft' | 'deleted';
}

// 用户
interface User {
  id: string;
  name: string;
  email: string;
  apiKey: string;           // API Key (哈希存储)
  createdAt: string;
}
```

## CLI 命令 (Bun)

```bash
# 认证
adk login <server-url> <api-key>   # 登录 (指定服务端地址)
adk logout                          # 登出

# 浏览
adk skill ls                # 列出所有 Skill
adk skill search <keyword>  # 搜索 Skill
adk skill info <name>       # 查看 Skill 详情

# 下载/上传
adk skill download <name>   # 下载 Skill 到本地 (ZIP)
adk skill upload <path>     # 上传本地 Skill (ZIP)

# 管理
adk skill my                # 我发布的 Skill
adk skill delete <name>     # 删除已发布 Skill
adk skill validate <path>   # 验证本地 Skill 格式
```

## API 设计

### 认证

| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/v1/auth/login` | 登录 (获取/验证 API Key) |
| GET | `/api/v1/auth/me` | 获取当前用户 |

### Skills

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/skills` | 列表/搜索 Skills |
| GET | `/api/v1/skills/:name` | 获取 Skill 详情 |
| GET | `/api/v1/skills/:name/download` | 下载 Skill ZIP |
| POST | `/api/v1/skills` | 上传/发布 Skill |
| DELETE | `/api/v1/skills/:name` | 删除 Skill |
| GET | `/api/v1/users/me/skills` | 我的发布列表 |

### 健康检查

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/health` | 健康检查 |

## 标准化返回

```typescript
interface ApiResponse<T> {
  ok: boolean;   // true/false
  data: T;        // 返回数据
  msg: string;    // 描述消息 (ok: "操作成功", fail: "错误原因")
}
```

## 项目结构

```
agent-resource-management/
├── cli/                        # Bun CLI
│   ├── src/
│   │   ├── cmd/
│   │   │   ├── auth.ts
│   │   │   ├── skill.ts
│   │   │   └── server.ts
│   │   ├── lib/
│   │   │   ├── client.ts       # API 客户端
│   │   │   ├── storage.ts      # 本地存储
│   │   │   └── formatter.ts
│   │   └── main.ts
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                     # Next.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/         # 认证页面
│   │   │   ├── (dashboard)/    # 管理后台
│   │   │   │   ├── skills/     # Skill 市场
│   │   │   │   ├── my-skills/   # 我的发布
│   │   │   │   └── settings/    # 设置
│   │   │   └── api/
│   │   │       └── v1/         # API Routes
│   │   │           ├── auth/
│   │   │           └── skills/
│   │   ├── components/
│   │   │   └── ui/             # shadcn/ui
│   │   ├── lib/
│   │   │   ├── db.ts
│   │   │   └── auth.ts
│   │   └── store/              # 状态管理
│   └── package.json
│
├── pkg/                        # 共享类型
│   └── types/
│       └── skill.ts
│
└── docs/
```

## 技术栈

| 组件 | 技术 |
|------|------|
| CLI | Bun + TypeScript + Ink (终端UI) |
| Backend | Next.js 14 (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| 数据库 | MySQL |
| 文件存储 | data/skills/ (本地) |
| 验证 | Zod |

## 实现步骤

### Phase 1: 基础架构
- [x] 1.1 创建项目目录结构
- [x] 1.2 定义共享类型 (pkg/types)
- [x] 1.3 设计 MySQL 表结构
- [x] 1.4 配置数据库连接

### Phase 2: Backend API
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

### Phase 3: Web UI
- [x] 3.1 搭建 Next.js + shadcn/ui 项目
- [x] 3.2 登录页 (API Key 登录)
- [x] 3.3 布局 (侧边栏 + 导航)
- [x] 3.4 Skill 市场列表页
- [x] 3.5 Skill 详情页 (下载按钮)
- [x] 3.6 我的发布列表页
- [x] 3.7 Skill 上传页面

### Phase 4: CLI (Bun)
- [x] 4.1 初始化 Bun 项目
- [x] 4.2 实现 CLI 框架 (命令解析)
- [x] 4.3 adk login 登录命令
- [x] 4.4 adk logout 登出命令
- [x] 4.5 adk skill ls 列出 Skills
- [x] 4.6 adk skill search 搜索 Skills
- [x] 4.7 adk skill info 查看详情
- [x] 4.8 adk skill download 下载并解压
- [x] 4.9 adk skill upload 上传 ZIP
- [x] 4.10 adk skill my 我的发布
- [x] 4.11 adk skill delete 删除
- [x] 4.12 adk skill validate 验证格式

### Phase 5: 完善
- [x] 5.1 ZIP 包格式验证
- [x] 5.2 SKILL.md frontmatter 验证
- [x] 5.3 错误处理规范化
- [x] 5.4 日志记录
- [x] 5.5 配置管理 (.adkrc)

