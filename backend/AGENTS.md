# ARM - Agent Resource Management

> 让智能体的每一次工作都有价值，每一次经验都不被丢失。

## 1. 项目概述

**ARM** 是一个企业级 Agent 资源管理系统，将 AI Agent 视为"数字员工"，管理 Skill（技能）和 Knowledge（知识）的全生命周期。

### 核心概念

| ARM 概念 | 说明 |
|----------|------|
| **Agent** | 数字化的 AI 工作单元 |
| **Skill** | 可复用的专业能力资产（ZIP 包） |
| **Knowledge** | 专业领域知识（Markdown） |
| **Binding** | 版本化的绑定关系（不可变） |

---

## 2. 技术栈速查

| 组件 | 技术 |
|------|------|
| Framework | Next.js 14 (App Router) |
| Database | MySQL + Prisma ORM |
| Validation | Zod |
| Auth | SSO + API Key |
| File Storage | `backend/data/skills/`, `backend/data/knowledges/` |
| Package Manager | **pnpm** (必须) |

---

## 3. 代码规范

### 3.1 目录结构

```
backend/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # 认证页面
│   │   ├── (dashboard)/               # 管理后台 UI
│   │   │   ├── agents/
│   │   │   ├── skills/
│   │   │   └── knowledges/
│   │   └── api/v1/                    # API Routes
│   │       ├── auth/
│   │       ├── agents/                # Agent CRUD + 绑定
│   │       ├── skills/
│   │       ├── knowledges/
│   │       ├── tags/
│   │       └── users/
│   ├── components/ui/                 # shadcn/ui 组件
│   └── lib/                            # 工具库
│       ├── db.ts                      # Prisma Client
│       ├── auth.ts                    # 认证函数
│       ├── api-response.ts            # 响应封装
│       ├── types.ts                   # TypeScript 类型
│       └── validation.ts              # Zod Schemas
├── prisma/
│   └── schema.prisma                  # 数据库 Schema
└── data/                              # 文件存储
    ├── skills/
    └── knowledges/

cli/                                    # Bun CLI 工具
├── src/
│   ├── cmd/                           # 命令实现
│   ├── lib/                           # 客户端库
│   └── main.ts
└── package.json
```

### 3.2 API 路由模式

**创建新 API 路由**：
```
src/app/api/v1/<entity>/route.ts        # 列表 + 创建
src/app/api/v1/<entity>/[id]/route.ts  # 详情 + 更新 + 删除
```

**路由文件模板**：

```typescript
import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return errorResponse('未授权', 401);

    // 业务逻辑

    return successResponse(data, '获取成功');
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('操作失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return errorResponse('未授权', 401);

    const body = await request.json();

    // 业务逻辑

    return successResponse(result, '操作成功');
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('操作失败');
  }
}
```

### 3.3 响应格式

```typescript
// 成功响应
{ "ok": true, "data": {...}, "msg": "操作成功" }

// 错误响应
{ "ok": false, "data": null, "msg": "错误原因" }
```

**辅助函数**：
```typescript
import { successResponse, errorResponse } from '@/lib/api-response';

return successResponse(data, '成功消息');
return errorResponse('错误消息', 400);  // status code 可选
```

### 3.4 数据库操作

```typescript
import prisma from '@/lib/db';

// Prisma Client 已经全局缓存，无需手动管理
const result = await prisma.agent.findMany({ ... });
```

### 3.5 认证模式

```typescript
import { authenticate, requireAuth } from '@/lib/auth';

// 方式 1: 手动认证
const user = await authenticate(request);
if (!user) return errorResponse('未授权', 401);

// 方式 2: requireAuth 辅助
const result = await requireAuth(request);
if (result instanceof Response) return result;  // 已返回错误响应
const { user, request } = result;  // 认证成功
```

### 3.6 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `agent-binding.ts` |
| 路由 | kebab-case | `/api/v1/agent-bindings` |
| 数据库表 | snake_case | `agent_skill_bindings` |
| Prisma 模型 | PascalCase | `AgentSkillBinding` |
| API 字段 | camelCase | `publishedBy`, `createdAt` |

---

## 4. 数据模型速查

### Prisma → API 类型映射

| Prisma Model | API Type | 说明 |
|--------------|----------|------|
| `Agent` | `Agent` | Agent 元信息 |
| `Skill` | `Skill` | Skill 元信息 |
| `Knowledge` | `Knowledge` | Knowledge 元信息 |
| `AgentSkillBinding` | `AgentSkill` | 版本化绑定 |
| `AgentKnowledgeBinding` | `AgentKnowledge` | 版本化绑定 |

### 关键约束

- **Agent.name** - 唯一，创建后不可修改
- **Skill.name** - 唯一
- **Knowledge.name** - 唯一
- **Binding** - `(agentId, skillId, version)` 唯一，版本只增不删

---

## 5. 常用命令

```bash
cd backend

# 开发
pnpm dev                    # 启动开发服务器
pnpm build                  # 构建
pnpm start                  # 生产启动

# 数据库
pnpm prisma generate        # 生成 Prisma Client
pnpm prisma db push         # 推送 Schema 到数据库
pnpm prisma studio          # 打开 Prisma Studio

# 代码质量
pnpm lint                   # ESLint 检查
pnpm typecheck              # TypeScript 类型检查

# CLI (项目根目录)
cd cli && bun run src/main.ts <command>
# 或全局安装后
arm <command>
```

---

## 6. 开发流程

### 6.1 添加新 API 路由

1. 在 `src/app/api/v1/` 下创建路由文件
2. 使用标准模板（见 3.2）
3. 注入 `authenticate` 认证
4. 使用 `successResponse` / `errorResponse` 返回
5. 错误处理使用 `try-catch` 包裹

### 6.2 添加数据库模型

1. 编辑 `prisma/schema.prisma`
2. 运行 `pnpm prisma generate` 生成类型
3. 运行 `pnpm prisma db push` 更新数据库
4. 在 `src/lib/types.ts` 添加对应的 API 类型

### 6.3 版本化绑定规则

**Skill/Knowledge 绑定遵循开闭原则**：

```
✅ 允许：新增绑定版本
✅ 允许：新增不同 skillId 的绑定
❌ 禁止：修改已存在的绑定版本
❌ 禁止：删除绑定记录（使用 deletedAt 软删除）
```

---

## 7. 架构图

```
┌─────────────────────────────────────────────────────┐
│                     CLI (arm)                        │
│   Bun + TypeScript                                   │
│   login → ls → search → download/upload → sync       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/REST
       ┌───────────────▼───────────────┐
       │      Next.js Backend           │
       │   App Router + API Routes      │
       │  ┌─────────────────────────┐   │
       │  │   Skill Registry       │   │
       │  │   Knowledge Store      │   │
       │  │   Agent Manager        │   │
       │  └─────────────────────────┘   │
       └───────────────┬────────────────┘
                       │
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
   ┌───────────┐ ┌───────────┐ ┌──────────┐
   │   MySQL   │ │   MySQL   │ │  data/   │
   │ Skills元数据│ │Knowledge │ │ skills/  │
   │ Bindings │ │ Bindings  │ │ knowledges│
   └───────────┘ └───────────┘ └──────────┘
```

---

## 8. 快速参考

### API 基础路径
```
http://localhost:3000/api/v1/
```

### 认证方式
```bash
# Header 方式
Authorization: Bearer <api-key>

# 或通过 Cookie (SSO)
```

### 分页参数
```
?page=1&pageSize=20
```

### 搜索参数
```
?keyword=xxx
```

### 状态过滤
```
?status=active
?status=draft
```

---

## 9. 文件上传路径

| 资源类型 | 存储路径 |
|----------|----------|
| Skill ZIP | `backend/data/skills/<skill-name>.zip` |
| Knowledge | `backend/data/knowledges/<id>.md` |

---

## 10. 状态机

### Agent 状态
```
draft → active → (归档)
```

### Skill 状态
```
draft → active → deleted
```

### Binding 状态
```
有效: deletedAt = null
已解绑: deletedAt = <timestamp>
```
