# Agent Resource Management (ARM) - CLI

Agent Resource Management CLI 是一个用于管理 Skills、Knowledges 和 Agents 的命令行工具，支持浏览、搜索、上传、下载、验证等功能。

**注意**: 本 CLI 需要配合 ARM Backend 后端管理系统一起使用。请先确保后端服务已启动。

## 功能特性

- 认证管理 (登录/登出)
- Skill 浏览与搜索
- Knowledge 浏览与搜索
- Agent 浏览与搜索
- 上传/下载/删除
- 本地验证
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
arm --help
```

### 或使用 Bun 直接运行

```bash
cd cli
bun run src/main.ts --help
```

## 快速开始

### 1. 登录

```bash
arm login http://localhost:3000 <your-api-key>
```

### 2. 浏览 Skills

```bash
# 列出所有 Skills
arm skill ls

# 搜索 Skills
arm skill search pdf

# 查看 Skill 详情
arm skill info pdf-tool
```

### 3. 浏览 Knowledges

```bash
# 列出所有 Knowledges
arm knowledge ls

# 搜索 Knowledges
arm knowledge search api-doc
```

### 4. 浏览 Agents

```bash
# 列出所有 Agents
arm agent ls

# 搜索 Agents
arm agent search assistant
```

### 5. 下载

```bash
# 下载 Skill 到当前目录
arm skill download pdf-tool

# 下载 Knowledge 到指定目录
arm knowledge download api-doc ./my-knowledges

# 下载 Agent 到指定目录
arm agent download workspace-assistant ./agents
```

### 6. 上传

```bash
# 上传本地 Skill 目录
arm skill upload ./my-skills/pdf-tool

# 上传本地 Knowledge 目录
arm knowledge upload ./my-knowledges/api-doc
```

### 7. 验证格式

```bash
# 验证 Skill 目录
arm skill validate ./my-skills/pdf-tool

# 验证 Skill ZIP 文件
arm skill validate ./my-skills/pdf-tool.zip
```

## 命令参考

### 认证命令

| 命令 | 说明 |
|------|------|
| `arm login <server-url> <api-key>` | 登录到指定服务端 |
| `arm logout` | 登出当前用户 |
| `arm me` | 显示当前用户信息 |

### Skill 命令

| 命令 | 说明 |
|------|------|
| `arm skill ls` | 列出所有公开 Skills |
| `arm skill search <keyword>` | 搜索 Skills |
| `arm skill info <name>` | 查看 Skill 详情 |
| `arm skill download <name> [dir]` | 下载 Skill 到指定目录 |
| `arm skill upload <path>` | 上传本地 Skill 目录 |
| `arm skill my` | 查看我发布的 Skills |
| `arm skill delete <name>` | 删除我发布的 Skill |
| `arm skill validate <path>` | 验证 Skill 格式（支持目录和 ZIP） |

### Knowledge 命令

| 命令 | 说明 |
|------|------|
| `arm knowledge ls` | 列出所有公开 Knowledges |
| `arm knowledge search <keyword>` | 搜索 Knowledges |
| `arm knowledge info <name>` | 查看 Knowledge 详情 |
| `arm knowledge download <name> [dir]` | 下载 Knowledge 到指定目录 |
| `arm knowledge upload <path>` | 上传本地 Knowledge 目录 |
| `arm knowledge my` | 查看我发布的 Knowledges |
| `arm knowledge delete <name>` | 删除我发布的 Knowledge |

### Agent 命令

| 命令 | 说明 |
|------|------|
| `arm agent ls` | 列出所有公开 Agents |
| `arm agent search <keyword>` | 搜索 Agents |
| `arm agent info <name>` | 查看 Agent 详情 |
| `arm agent download <name> [dir]` | 下载 Agent 到指定目录 |

### 服务端命令

| 命令 | 说明 |
|------|------|
| `arm server` | 显示当前服务端 |
| `arm server set <url>` | 设置默认服务端 |

## Skill 格式规范

上传的 Skill 目录必须包含 `SKILL.md` 文件，且 frontmatter 必须符合以下格式：

```yaml
---
name: skill-name          # 必填，小写字母、数字、连字符
description: 描述        # 必填，1-1024 字符
license: MIT             # 可选
compatibility: 兼容性信息 # 可选
allowed-tools: tool1 tool2 # 可选，空格分隔
---

# Skill 说明

这里是 Skill 的详细说明文档...
```

### 验证规则

- `name`: 必填，只能包含小写字母、数字和连字符，1-64 字符
- `description`: 必填，1-1024 字符
- `license`: 可选
- `compatibility`: 可选
- `allowed-tools`: 可选，空格分隔的字符串

## 配置文件

登录后配置保存在 `~/.arm/config.json`:

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

本 CLI 需要配合 ARM Backend 使用。启动后端服务：

```bash
cd backend
npm install
npm run dev
```

后端默认运行在 `http://localhost:3000`。

## License

MIT
