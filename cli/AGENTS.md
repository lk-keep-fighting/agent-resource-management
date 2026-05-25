# ARM CLI 开发规范

> Agent Resource Management CLI 工具

## 1. 项目概述

ARM CLI 是一个基于 Bun + TypeScript 的命令行工具，用于管理 Agent、Skill、Knowledge 资源。

### 命令结构

```
arm <entity> <action> [options]

Entities:
  - auth        # 认证
  - skill       # Skill 管理
  - knowledge    # Knowledge 管理
  - agent       # Agent 管理
  - server      # 服务端配置
  - output      # 输出模式配置
  - me          # 当前用户信息
```

---

## 2. 技术栈

| 组件 | 技术 |
|------|------|
| Runtime | Bun |
| Language | TypeScript |
| HTTP Client | Fetch API |
| 类型 | `@pkg/types/skill` |

---

## 3. 目录结构

```
cli/
├── src/
│   ├── main.ts              # CLI 入口，命令解析
│   ├── cmd/                 # 命令实现
│   │   ├── auth.ts          # login/logout/register
│   │   ├── skill.ts         # Skill CRUD
│   │   ├── knowledge.ts     # Knowledge CRUD
│   │   ├── agent.ts         # Agent CRUD + bind/sync
│   │   └── server.ts        # 服务端配置
│   └── lib/                 # 工具库
│       ├── client.ts        # ApiClient HTTP 客户端
│       ├── storage.ts       # 本地配置存储 (~/.arm/)
│       ├── output.ts         # JSON/Text 输出模式
│       ├── formatter.ts     # 格式化输出
│       └── validate.ts       # 本地验证
├── package.json
└── tsconfig.json
```

---

## 4. 核心库

### 4.1 ApiClient

HTTP 客户端封装，基于 Fetch API：

```typescript
import { ApiClient } from './lib/client';

const client = new ApiClient(serverUrl, token);

// 设置 Token
client.setToken(token);

// 认证
await client.login(apiKey);
await client.me();

// Skills
await client.listSkills(keyword?, page?, pageSize?);
await client.getSkill(name);
await client.uploadSkill(filePath);
await client.downloadSkill(name);

// Agents
await client.listAgents(keyword?, page?, pageSize?);
await client.getAgent(id);
await client.createAgent(data);
await client.updateAgent(id, data);
await client.deleteAgent(id);
await client.bindSkillToAgent(agentId, skillId, version, config?);
await client.unbindSkillFromAgent(agentId, skillId, version?);
```

### 4.2 Storage

本地配置存储在 `~/.arm/config.json`：

```typescript
import { loadConfig, saveConfig, clearConfig } from './lib/storage';

const config = loadConfig();
// { serverUrl, token, user, outputMode }

saveConfig({ serverUrl, token, user });
clearConfig();  // 只清除 token 和 user
```

### 4.3 Output

支持 JSON 和 Text 两种输出模式：

```typescript
import { shouldOutputJson, outputJson } from './lib/output';

// 检查是否应该输出 JSON
if (shouldOutputJson()) {
  outputJson({ success: true, data: {...} });
  return;
}

// Text 模式输出
console.log('Normal output');
```

**JSON 输出格式**：

```typescript
{ success: true, data: {...} }
{ success: false, error: { code: 'ERROR_CODE', message: '...' } }
```

---

## 5. 命令开发规范

### 5.1 命令模板

```typescript
export async function myCommand(id: string, options: { flag?: boolean } = {}): Promise<void> {
  // 1. 检查登录状态
  const config = loadConfig();
  if (!config?.token) {
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'NOT_LOGGED_IN', message: '未登录' } });
      process.exit(1);
    }
    error('未登录，请先运行 arm login');
    process.exit(1);
  }

  // 2. 创建客户端
  const client = new ApiClient(config.serverUrl, config.token);

  try {
    // 3. 业务逻辑
    const result = await client.someMethod();

    // 4. 输出结果
    if (shouldOutputJson()) {
      outputJson({ success: true, data: result });
      return;
    }
    success('操作成功');

  } catch (err) {
    // 5. 错误处理
    if (shouldOutputJson()) {
      outputJson({ success: false, error: { code: 'METHOD_FAILED', message: err instanceof Error ? err.message : '未知错误' } });
      process.exit(1);
    }
    error(`操作失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}
```

### 5.2 main.ts 命令注册

```typescript
case 'entity':
  switch (subCommand) {
    case 'action':
      if (!args[2]) {
        console.error('用法: arm entity action <id> [--flag] [--json]');
        process.exit(1);
      }
      await myCommand(args[2], { flag: args.includes('--flag') });
      break;
    default:
      console.log(`可用命令: arm entity action <id>`);
  }
  break;
```

### 5.3 错误码规范

| 错误码 | 说明 |
|--------|------|
| `NOT_LOGGED_IN` | 未登录 |
| `NOT_FOUND` | 资源不存在 |
| `CREATE_FAILED` | 创建失败 |
| `UPDATE_FAILED` | 更新失败 |
| `DELETE_FAILED` | 删除失败 |
| `BIND_FAILED` | 绑定失败 |
| `UNBIND_FAILED` | 解绑失败 |
| `UPLOAD_FAILED` | 上传失败 |
| `DOWNLOAD_FAILED` | 下载失败 |
| `SYNC_FAILED` | 同步失败 |
| `VALIDATION_FAILED` | 验证失败 |
| `FILE_NOT_FOUND` | 文件不存在 |

---

## 6. 常用命令速查

### 6.1 认证

```bash
arm login <server-url> <api-key>
arm logout
arm me
```

### 6.2 Skill

```bash
arm skill ls                        # 列出
arm skill search <keyword>          # 搜索
arm skill info <name>               # 详情
arm skill download <name> [dir]    # 下载
arm skill upload <path>            # 上传
arm skill my                        # 我的发布
arm skill delete <name>             # 删除
arm skill validate <path>          # 验证
```

### 6.3 Knowledge

```bash
arm knowledge ls
arm knowledge search <keyword>
arm knowledge info <name>
arm knowledge download <name> [dir]
arm knowledge upload <path>
arm knowledge my
arm knowledge delete <name>
```

### 6.4 Agent

```bash
# 基础 CRUD
arm agent ls
arm agent search <keyword>
arm agent info <name>
arm agent create <name> [--description=...] [--prompt=...]
arm agent create --from=<folder>   # 从文件夹创建
arm agent update <id> [--name=...] [--description=...] [--prompt=...] [--status=active|draft]
arm agent delete <id>

# 绑定管理
arm agent bind <id> --skill=<skillId> [--skill-config='{...}']
arm agent unbind <id> --skill=<skillId> [--version=<ver>]
arm agent bind <id> --knowledge=<knowledgeId>
arm agent unbind <id> --knowledge=<knowledgeId> [--version=<ver>]

# 同步
arm agent sync <folder> [--dry-run] [--force]
```

### 6.5 配置

```bash
arm output [json|text]             # 输出模式
arm server                          # 显示服务端
arm server set <url>               # 设置服务端
```

---

## 7. Agent 文件夹结构

`arm agent create --from=<folder>` 支持的目录结构：

```
<folder>/
├── AGENT.md           # Agent 元信息 (必填)
├── skills/            # 可选: Skill 子目录
│   └── <skill-name>/
│       └── SKILL.md
└── knowledges/        # 可选: Knowledge 目录
    └── <name>.md
```

### AGENT.md 格式

```yaml
---
name: my-agent
description: 我的 Agent 描述
prompt: |
  You are a helpful assistant.
---
```

---

## 8. 开发命令

```bash
cd cli

# 安装依赖
bun install

# 运行 CLI
bun run src/main.ts <command>

# 或全局链接
bun link
arm <command>

# 类型检查
bun run typecheck
```

---

## 9. 关键实现细节

### 9.1 API 路径前缀

```typescript
// client.ts
`${this.serverUrl}/api/v1${path}`
```

### 9.2 分页参数

```typescript
?page=1&pageSize=20
```

### 9.3 搜索参数

```typescript
?keyword=<encoded-keyword>
```

### 9.4 状态过滤

```typescript
?status=active
?status=draft
```

### 9.5 文件上传

使用 `FormData` 而非 JSON：

```typescript
const formData = new FormData();
const blob = new Blob([fileBuffer]);
formData.append('file', blob, fileName);

fetch(url, { method: 'POST', body: formData, headers });
```
