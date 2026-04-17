# ARM - Agent Resource Management

借鉴**人力资源管理 (HRM)** 思想的 Agent 资源管理系统。将 AI Agent 视为"数字员工"，对 Skill、Knowledge 等资源进行全生命周期管理，实现资源的**获取、配置、调度与绩效评估**。

## 核心概念

| ARM 概念 | HRM 对应 | 说明 |
|----------|----------|------|
| Agent | 员工 | 数字化的 AI 工作单元 |
| Skill (能力) | 技能/能力 | 可复用的专业能力资产 |
| Knowledge (知识) | 知识库 | 专业领域知识存储 |
| Orchestration (编排) | 团队协作 | 多 Agent 协同工作 |

## 功能特性

- **Agent 工厂**: 创建、配置和管理数字员工团队
- **能力资产库**: Skill 市场的浏览、获取和发布
- **知识资源库**: 管理和组织专业知识
- **资源编排**: 多 Agent 协作与任务调度 (规划中)
- **用户认证**: SSO 单点登录 + API Key 认证
- **Web UI**: 基于 shadcn/ui + Tailwind CSS 的管理后台
- **REST API**: 完整的 RESTful API 接口

## 技术栈

| 组件 | 技术 |
|------|------|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + shadcn/ui + Tailwind CSS |
| Database | MySQL + Prisma ORM |
| File Storage | 本地文件系统 |
| Validation | Zod |
| Auth | SSO + API Key |

## 项目结构

```
agent-skill-system/
├── backend/                      # ARM 主服务
│   ├── prisma/
│   │   └── schema.prisma         # Prisma 数据模型
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/          # 认证页面
│   │   │   ├── (dashboard)/     # 管理后台
│   │   │   │   ├── agents/      # Agent 工厂
│   │   │   │   ├── skills/      # 能力资产库
│   │   │   │   ├── knowledges/  # 知识资源库
│   │   │   │   ├── my/          # 我的资源
│   │   │   │   └── admin/       # 管理员功能
│   │   │   └── api/v1/          # API Routes
│   │   │       ├── auth/        # 认证接口
│   │   │       ├── agents/      # Agent 接口
│   │   │       ├── skills/      # Skill 接口
│   │   │       ├── knowledges/  # Knowledge 接口
│   │   │       └── stats/       # 统计接口
│   │   ├── components/ui/       # UI 组件
│   │   └── lib/                 # 工具库
│   └── data/                    # 文件存储
├── cli/                         # ADK CLI 工具
│   └── src/
│       ├── cmd/                 # 命令实现
│       └── lib/                 # 客户端库
└── pkg/                        # 共享包
    └── types/                   # 类型定义
```

## 快速开始

### 1. 环境要求

- Node.js 18+
- MySQL 8.0+
- pnpm

### 2. 配置环境变量

创建 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=arm_system
DATABASE_URL="mysql://root:your_password@localhost:3306/arm_system"
NEXT_PUBLIC_SSO_URL=http://localhost:3000
```

### 3. 数据库初始化

```bash
cd backend
pnpm install

# 生成 Prisma Client
pnpm prisma generate

# 推送 schema 到数据库
pnpm prisma db push
```

### 4. 启动服务

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build && pnpm start
```

服务地址: http://localhost:3000

## 核心模块

### Agent 工厂

创建和管理数字员工团队，配置其技能和知识。

### 能力资产库

Skill 市场的核心模块，支持：
- 浏览和搜索能力资产
- 上传和发布新能力
- 下载能力到本地
- 管理我发布的能力

### 知识资源库

管理和组织专业知识：
- 创建本地知识
- 同步外部知识服务
- 为 Agent 绑定知识

### 资源编排 (规划中)

多 Agent 协作与任务调度中心。

## API 接口

### 统计

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/stats` | 获取系统统计 |

### 认证

| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/v1/auth/login` | API Key 登录 |
| GET | `/api/v1/auth/me` | 获取当前用户 |
| GET | `/api/auth/session` | 获取会话 |

### Agent

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/agents` | 列表/搜索 |
| POST | `/api/v1/agents` | 创建 |
| GET | `/api/v1/agents/:id` | 详情 |
| PUT | `/api/v1/agents/:id` | 更新 |
| DELETE | `/api/v1/agents/:id` | 删除 |
| POST | `/api/v1/agents/:id/skills` | 绑定技能 |
| POST | `/api/v1/agents/:id/knowledges` | 绑定知识 |

### Skill (能力)

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/skills` | 列表/搜索 |
| GET | `/api/v1/skills/:name` | 详情 |
| GET | `/api/v1/skills/:name/download` | 下载 |
| POST | `/api/v1/skills` | 上传/发布 |
| DELETE | `/api/v1/skills/:name` | 删除 |
| GET | `/api/v1/users/me/skills` | 我的发布 |

### Knowledge (知识)

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/v1/knowledges` | 列表/搜索 |
| POST | `/api/v1/knowledges` | 创建 |
| GET | `/api/v1/knowledges/:id` | 详情 |
| GET | `/api/v1/users/me/knowledges` | 我的知识 |

### 响应格式

```typescript
interface ApiResponse<T> {
  ok: boolean;
  data: T;
  msg: string;
}
```

## 页面路由

| 路径 | 页面 |
|------|------|
| `/` | 首页 |
| `/login` | 登录页 |
| `/agents` | Agent 工厂 |
| `/skills` | 能力资产库 |
| `/knowledges` | 知识资源库 |
| `/my` | 我的资源 |
| `/upload` | 资源上传 |
| `/admin/skills` | 能力审核 (管理员) |
| `/admin/knowledges` | 知识审核 (管理员) |

## CLI 工具

配套的 ADK CLI 工具支持命令行管理资源和 Agent：

```bash
# 登录
adk login http://localhost:3000 <api-key>

# 浏览能力
adk skill ls
adk skill search <keyword>

# 下载/上传能力
adk skill download <name>
adk skill upload <path>

# 管理 Agent
adk agent ls
adk agent info <id>
```

详见 [CLI README](./cli/README.md)

## 常用命令

```bash
# 后端开发
cd backend
pnpm dev        # 开发模式
pnpm build      # 构建
pnpm start      # 生产启动
pnpm lint       # 代码检查
```

## 开发指南

### 添加新 API 路由

在 `src/app/api/v1/` 下创建路由文件：

```
src/app/api/v1/example/route.ts
```

### 数据库操作

使用 `src/lib/db.ts` 中导出的 Prisma Client：

```typescript
import prisma from '@/lib/db';

const agents = await prisma.agent.findMany();
```

### API 响应封装

```typescript
import { successResponse, errorResponse } from '@/lib/api-response';

return successResponse(data, '操作成功');
return errorResponse('错误信息', 400);
```

## License

MIT