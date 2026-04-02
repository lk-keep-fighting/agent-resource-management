# Agent Skill System - Backend

企业级 Agent 技能分发平台后端服务，基于 Next.js 14 App Router 构建。

## 功能特性

- **Skill 管理**: 上传、下载、搜索、删除 Skills
- **用户认证**: API Key 认证机制
- **Web UI**: 基于 shadcn/ui + Tailwind CSS 的管理后台
- **REST API**: 完整的 RESTful API 接口

## 技术栈

| 组件 | 技术 |
|------|------|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + shadcn/ui + Tailwind CSS |
| Database | MySQL |
| File Storage | 本地文件系统 (`data/skills/`) |
| Validation | Zod |

## 项目结构

```
backend/
├── src/
│   ├── app/
│   │   ├── (auth)/              # 认证页面
│   │   │   └── login/
│   │   ├── (dashboard)/         # 管理后台
│   │   │   ├── skills/          # Skill 市场
│   │   │   ├── my-skills/       # 我的发布
│   │   │   └── settings/        # 设置
│   │   └── api/v1/              # API Routes
│   │       ├── auth/            # 认证接口
│   │       ├── skills/          # Skill 接口
│   │       └── health/          # 健康检查
│   ├── components/ui/           # UI 组件
│   └── lib/
│       ├── auth.ts              # 认证中间件
│       ├── db.ts                # 数据库连接
│       ├── api-response.ts       # API 响应封装
│       ├── types.ts             # 类型定义
│       └── validation.ts         # 验证函数
├── data/                        # Skill 文件存储
├── scripts/
│   └── test-api.js             # 回归测试脚本
└── docs/                       # 设计文档
```

## 快速开始

### 1. 环境要求

- Node.js 18+
- MySQL 8.0+
- npm 或 yarn

### 2. 配置环境变量

创建 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=agent_skill_system
```

**注意**: 如果密码包含特殊字符 `#` 或 `$`，需要使用双引号包裹并转义：
```env
DB_PASSWORD="your#password"
```

### 3. 数据库初始化

```sql
CREATE DATABASE agent_skill_system;
USE agent_skill_system;

CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  api_key_hash VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skills (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  license VARCHAR(255),
  compatibility VARCHAR(500),
  metadata JSON,
  allowed_tools TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_hash VARCHAR(128) NOT NULL,
  published_by VARCHAR(36) NOT NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('active', 'draft', 'deleted') DEFAULT 'active',
  download_count INT DEFAULT 0,
  INDEX idx_name (name),
  INDEX idx_status (status),
  INDEX idx_published_by (published_by),
  FOREIGN KEY (published_by) REFERENCES users(id)
);
```

### 4. 安装依赖

```bash
npm install
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm run start
```

服务地址: http://localhost:3000

## API 接口

### 认证

| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/v1/auth/login` | 登录 (验证 API Key) |
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

### 响应格式

```typescript
interface ApiResponse<T> {
  ok: boolean;   // true/false
  data: T;      // 返回数据
  msg: string;   // 描述消息
}
```

## 回归测试

### 运行测试

```bash
# 方式一: 直接运行
node scripts/test-api.js

# 方式二: 使用 npm script (需在 package.json 添加)
npm run test:api
```

### 测试用例说明

测试脚本 `scripts/test-api.js` 实现了 TEST_CASES.md 中定义的 Backend API 测试用例：

| 测试编号 | 描述 |
|---------|------|
| TC-API-001 | POST /api/v1/auth/login - 成功登录 |
| TC-API-002 | POST /api/v1/auth/login - 无效 API Key |
| TC-API-003 | GET /api/v1/auth/me - 带 Token |
| TC-API-004 | GET /api/v1/auth/me - 无 Token |
| TC-API-005 | GET /api/v1/skills - 列表 |
| TC-API-006 | GET /api/v1/skills - 分页 |
| TC-API-007 | GET /api/v1/skills - 搜索 |
| TC-API-008 | GET /api/v1/skills/:name - 详情 |
| TC-API-009 | GET /api/v1/skills/:name - 不存在 |
| TC-API-010 | GET /api/v1/skills/:name/download - 下载 |
| TC-API-016 | GET /api/v1/users/me/skills - 我的发布 |
| TC-API-017 | GET /api/v1/health - 健康检查 |

### 测试输出示例

```
============================================================
Backend API Regression Tests
============================================================

TC-API-001: POST /api/v1/auth/login - Success
  ✓ Status is 200
  ✓ Response ok is true
  ...

============================================================
Test Summary
============================================================
Total:  33
Passed: 33
Failed: 0
Duration: 0.39s
============================================================
```

### 前置条件

1. MySQL 服务运行中
2. 数据库表已创建
3. 测试用户已创建 (API Key: `4567c9e607564e91b3898c46d89cb68dc4e40ec4a52b456699b695cf800fd446`)
4. Next.js 服务运行中 (`npm run dev`)

### 创建测试用户

```bash
node scripts/create-user.ts
```

## 创建管理员账号

系统没有预设管理员账号，需要手动创建：

```bash
node scripts/create-user.ts
```

脚本会生成新的 API Key，请妥善保存。

## 页面路由

| 路径 | 页面 |
|------|------|
| `/login` | 登录页 |
| `/skills` | Skill 市场 |
| `/skills/[name]` | Skill 详情 |
| `/my-skills` | 我的发布 |
| `/upload` | 上传 Skill |
| `/settings` | 设置 |

## 常用命令

```bash
npm run dev      # 开发模式
npm run build    # 构建生产版本
npm run start    # 启动生产服务
npm run lint     # 代码检查
```

## 开发指南

### 添加新 API 路由

在 `src/app/api/v1/` 下创建路由文件：

```
src/app/api/v1/example/route.ts
```

### 数据库连接

使用 `src/lib/db.ts` 中的 `query` 函数：

```typescript
import { query } from '@/lib/db';

const users = await query<User[]>('SELECT * FROM users WHERE id = ?', [id]);
```

### API 响应

使用 `src/lib/api-response.ts` 中的封装函数：

```typescript
import { successResponse, errorResponse } from '@/lib/api-response';

return successResponse(data, '操作成功');
return errorResponse('错误信息', 400);
```