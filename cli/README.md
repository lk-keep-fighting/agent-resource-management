# Agent Development Kit (ADK) - CLI

Agent Skill CLI 是一个用于管理 Agent Skills 的命令行工具，支持技能的浏览、搜索、上传、下载、验证等功能。

**注意**: 本 CLI 需要配合 [Agent Skill Backend](https://github.com/your-repo/agent-skill-backend) 后端管理系统一起使用。请先确保后端服务已启动。

## 功能特性

- 认证管理 (登录/登出)
- 技能浏览与搜索
- 技能详情查看
- 技能上传/下载/删除
- 技能本地验证
- 多服务端支持

## 安装

### 前置要求

- Node.js >= 18 或 Bun >= 1.0

### 全局安装

```bash
cd cli
npm install
npm run build
npm link

# 验证安装
adk --help
```

### 或使用 Bun 直接运行

```bash
cd cli
bun run src/main.ts --help
```

## 快速开始

### 1. 登录

```bash
adk login http://localhost:3000 <your-api-key>
```

### 2. 浏览技能

```bash
# 列出所有技能
adk skill ls

# 搜索技能
adk skill search pdf

# 查看技能详情
adk skill info pdf-tool
```

### 3. 下载技能

```bash
# 下载到当前目录
adk skill download pdf-tool

# 下载到指定目录
adk skill download pdf-tool ./my-skills
```

### 4. 上传技能

```bash
# 上传本地技能目录
adk skill upload ./my-skills/pdf-tool
```

### 5. 验证技能格式

```bash
# 验证本地技能目录
adk skill validate ./my-skills/pdf-tool

# 验证 ZIP 文件
adk skill validate ./my-skills/pdf-tool.zip
```

## 命令参考

### 认证命令

| 命令 | 说明 |
|------|------|
| `adk login <server-url> <api-key>` | 登录到指定服务端 |
| `adk logout` | 登出当前用户 |
| `adk me` | 显示当前用户信息 |

### 技能浏览命令

| 命令 | 说明 |
|------|------|
| `adk skill ls` | 列出所有公开技能 |
| `adk skill search <keyword>` | 搜索技能 |
| `adk skill info <name>` | 查看技能详情 |

### 技能管理命令

| 命令 | 说明 |
|------|------|
| `adk skill download <name> [dir]` | 下载技能到指定目录 |
| `adk skill upload <path>` | 上传本地技能目录 |
| `adk skill my` | 查看我发布的技能 |
| `adk skill delete <name>` | 删除我发布的技能 |
| `adk skill validate <path>` | 验证技能格式（支持目录和 ZIP） |

### 服务端命令

| 命令 | 说明 |
|------|------|
| `adk server` | 显示当前服务端 |
| `adk server set <url>` | 设置默认服务端 |

## 技能格式规范

上传的技能目录必须包含 `SKILL.md` 文件，且 frontmatter 必须符合以下格式：

```yaml
---
name: skill-name          # 必填，小写字母、数字、连字符
description: 描述        # 必填，1-1024 字符
license: MIT             # 可选
compatibility: 兼容性信息 # 可选
allowed-tools: tool1 tool2 # 可选，空格分隔
---

# 技能说明

这里是技能的详细说明文档...
```

### 验证规则

- `name`: 必填，只能包含小写字母、数字和连字符，1-64 字符
- `description`: 必填，1-1024 字符
- `license`: 可选
- `compatibility`: 可选
- `allowed-tools`: 可选，空格分隔的字符串

## 配置文件

登录后配置保存在 `~/.adk/config.json`:

```json
{
  "serverUrl": "http://localhost:3000",
  "token": "your-jwt-token",
  "user": {
    "id": "user-id",
    "name": "username",
    "email": "user@example.com"
  }
}
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式（使用 bun）
bun run dev

# 构建
npm run build

# 运行测试
./test-regression.sh
```

## 后端配合

本 CLI 需要配合 Agent Skill Backend 使用。启动后端服务：

```bash
cd backend
npm install
npm run dev
```

后端默认运行在 `http://localhost:3000`。

## License

MIT
