# Agent Workstation 设计稿（v3 · MVP）

> 与 ARM 数据强绑定的 **独立 Agent 工作站**。基于 `pi-coding-agent` SDK 快速跑通
> **选 Agent → 创建工作空间 → 对话 → 沉淀资产 → 评分反馈** 的最小闭环。

---

## 0. v3 变更摘要 + 全部决策

### v2 → v3 主要变化

| 维度 | v2 | **v3 MVP** |
|------|----|-----------|
| 落地 | monorepo 子包 | **monorepo 子包**（不变） |
| DB | 独立 MySQL | **独立 SQLite**（better-sqlite3，零部署成本） |
| 鉴权 | ARM SSO + JWT | **完全无鉴权**（MVP 单用户） |
| 权限 | 角色矩阵 | **完全不管权限** |
| Workspace 模板 | 待定 | **不做** |
| Prompt 策略 | 追加 | **追加** |
| 配额 | 待定 | **不做** |
| 沙箱 | 待定 | **不做**（用 pi 默认能力） |
| LLM | 多 provider | **OpenAI 兼容**（一个配置项搞定） |
| Agent 实现 | 自研执行引擎 | **基于 `pi-coding-agent` SDK** |
| CLI 定位 | 工作站是主入口 | **CLI 是 Agent 的一个 Tool** |

### 12 项决策表（已确认）

| # | 决策项 | 选择 |
|---|--------|------|
| 1 | 落地形态 | monorepo 子包 `workstation/` |
| 2 | 数据库 | **独立 SQLite**（`workstation/data/workstation.db`） |
| 3 | 鉴权 | **不做** |
| 4 | 权限 | **不做** |
| 5 | Workspace 模板 | **不做** |
| 6 | Prompt 策略 | **追加**（Workspace.context 追加在 Agent.prompt 之后） |
| 7 | 配额 | **不做** |
| 8 | 沙箱 | **不做** |
| 9 | LLM | **OpenAI 兼容**（配置文件指定 baseUrl + apiKey + model） |
| 10 | CLI 定位 | **CLI 是 Agent 的一个内置 Tool** |
| 11 | 用户管理 | **不管** |
| 12 | Agent SDK | **`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`** |

---

## 1. MVP 范围

### 1.1 必须做（最小闭环）

1. **Agent 员工选择** —— 列出 ARM 中所有 Agent，进入详情
2. **创建工作空间** —— 给某个 Agent 起名 + 写场景描述（context），进入对话
3. **对话** —— SSE 流式响应、工具调用、上下文隔离、多 Workspace 互不干扰
4. **Run 历史** —— 一个 Workspace 内多次 Run 的历史可回看
5. **评分反馈** —— Run 完成可点 👍 / 👎 / 1-5 星 + 文字评论
6. **资产沉淀** —— 从 Run 提取内容，**通过 ARM API** 创建新的 Skill / Knowledge / Agent
7. **CLI 作为 Tool** —— Agent 内置一个 `arm_cli` 工具，能调 `arm skill info/download`、`arm knowledge info` 等

### 1.2 明确不做（出 MVP 后再考虑）

| 不做 | 原因 |
|------|------|
| 用户登录 / SSO / 鉴权 | MVP 单用户，部署在内网即用 |
| 角色 / 权限 / 审核 | 同上 |
| Workspace 成员协作 | 无鉴权就不存在协作 |
| Workspace 文件上传 / 私有知识 | MVP 用 Prompt 注入替代 RAG |
| 成果广场 / Feed / Fork | 资产沉淀先做最小版（私有 → 直传 ARM），不做社区浏览 |
| 推荐算法 / 排行 | 等数据沉淀后再做 |
| 飞书 IM / 通知 | 等核心闭环跑通 |
| Skill 脚本沙箱 | 用 pi 默认能力；单用户自用风险可控 |
| 多 LLM 切换 / 配额 | 一个配置文件搞定 |
| 配额 / 计费 | 不做 |

---

## 2. 架构总览

### 2.1 部署形态

```
agent-resource-management/                ← 当前仓库（monorepo）
├── backend/                              ← ARM 现有 Next.js（不动）
├── cli/                                  ← ARM CLI（升级为 Agent Tool）
├── pkg/                                  ← 共享类型（扩展）
└── workstation/                          ← ⭐ 新增独立子包
    ├── package.json
    ├── data/
    │   └── workstation.db                ← SQLite 文件
    ├── storage/
    │   └── workspace-files/              ← 上传文件本地存储（MVP 不用，留位）
    ├── src/
    │   ├── server.ts                     ← Express/Hono 启动入口
    │   ├── routes/
    │   │   ├── agents.ts                 ← 消费 ARM API
    │   │   ├── workspaces.ts             ← 工作空间 CRUD
    │   │   ├── runs.ts                   ← 对话 / 流式
    │   │   └── feedback.ts
    │   ├── execution/                    ← Agent 运行时（基于 pi-agent-core）
    │   │   ├── agent-runner.ts           ← 封装 Agent 实例生命周期
    │   │   ├── context-builder.ts        ← 三层 Prompt 组装
    │   │   ├── tools/
    │   │   │   ├── arm-cli.ts            ← ARM CLI 作为 Tool ⭐
    │   │   │   └── skill-loader.ts       ← 按 SKILL.md 加载脚本
    │   │   └── event-stream.ts           ← Agent 事件 → SSE
    │   ├── db/
    │   │   ├── sqlite.ts                 ← better-sqlite3 连接
    │   │   ├── migrate.ts                ← 迁移脚本
    │   │   └── repos/                    ← Repository 层
    │   ├── arm-client/
    │   │   └── client.ts                 ← 调用 ARM REST API
    │   ├── web/
    │   │   └── index.html                ← 工作站前端（一个 SPA）
    │   └── config.ts                     ← 读环境变量
    └── README.md
```

**为什么不用 Next.js 而用纯 Node + 前端 SPA？**
- SQLite + better-sqlite3 在纯 Node 下最直接；不引入 ORM 复杂度
- 前端单独一个 HTML / Vite SPA 即可，避免 Next.js Server Component 嵌套
- 部署：`bun run src/server.ts` 一行启动

> **可替代方案**：如果团队更熟 Next.js，也可用 Next.js 14 + API Routes + better-sqlite3。下文技术细节以"纯 Node + Vite"为基线。

### 2.2 与 ARM 的关系

```
┌──────────────────────────────────────┐
│        Agent Workstation            │
│        (独立子包 / 独立进程)         │
│                                      │
│   ┌──────────────────────────┐      │
│   │  Agent Runtime           │      │
│   │  (pi-agent-core)         │      │
│   └─────────┬────────────────┘      │
│             │                         │
│   ┌─────────▼────────────────┐      │
│   │  Workstation SQLite       │      │
│   │  (workspace/run/feedback) │      │
│   └──────────────────────────┘      │
│             │ HTTP                    │
└─────────────┼────────────────────────┘
              ▼
┌──────────────────────────────────────┐
│           ARM Backend                │
│       (复用现有 Next.js)              │
│                                      │
│  - agents / skills / knowledges       │
│  - /api/v1/*                         │
│  - MySQL (ARM 现有)                  │
└──────────────────────────────────────┘
```

**核心约束**：工作站 **不直接读写** ARM 的 MySQL，所有数据消费通过 ARM REST API。

### 2.3 技术栈

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行时 | Bun / Node 20+ | 与 ARM CLI 一致 |
| HTTP | Hono 或 Express | 轻量 |
| DB | better-sqlite3 | 同步、零部署、单文件 |
| Agent SDK | `@earendil-works/pi-agent-core` 0.79.x | 用户指定 |
| LLM | `@earendil-works/pi-ai` | OpenAI 兼容统一接口 |
| 流式 | SSE（text/event-stream） | 浏览器原生 EventSource |
| 前端 | Vite + React + TypeScript | 启动快；shadcn/ui 复用 ARM 风格 |
| Schema 校验 | TypeBox | 与 pi-agent-core 一致 |
| 日志 | console（MVP） | 后续上 pino |

---

## 3. SDK 选型：`@earendil-works/pi-agent-core`

### 3.1 为什么用它

| 需求 | pi-agent-core 怎么解 |
|------|----------------------|
| Agent 状态管理（消息/工具/系统 prompt） | `Agent.state` 持久化所有运行时状态 |
| 工具调用 | `AgentTool` + TypeBox schema + `state.tools = [...]` |
| 流式响应 | `agent.subscribe()` 监听 `message_update` 的 `text_delta` |
| 多轮 | `agent.prompt()` 持续追加 message |
| 用户中断 | `agent.abort()` |
| 用户打断并改方向 | `agent.steer({...})` |
| 排队后续任务 | `agent.followUp({...})` |
| 自定义消息类型 | declaration merging + `convertToLlm` 过滤 |
| 自定义后端 | `streamFn: streamProxy` |
| OpenAI 兼容 | `getModel("openai", "gpt-4o", { baseUrl, apiKey })` |

### 3.2 安装

```bash
bun add @earendil-works/pi-agent-core @earendil-works/pi-ai typebox
```

### 3.3 最小用法预览

```typescript
import { Agent } from "@earendil-works/pi-agent-core";
import { getModel } from "@earendil-works/pi-ai";
import { armCliTool } from "./execution/tools/arm-cli";

const agent = new Agent({
  initialState: {
    systemPrompt: "你是一名 Bug 分类专员...（来自 ARM Agent.prompt）",
    model: getModel("openai", "gpt-4o", {
      baseUrl: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [armCliTool],
  },
  transformContext: async (messages) => {
    // 每次 prompt 前注入 Workspace 上下文
    return injectWorkspaceContext(messages, currentWorkspace);
  },
});

agent.subscribe((event) => {
  // 转发到 SSE 客户端
  sse.send({ type: event.type, payload: event });
});

await agent.prompt(userInput);
```

### 3.4 SDK 与本设计的概念映射

| 本设计概念 | pi-agent-core 实现 |
|------------|-------------------|
| Workspace | `Agent` 实例（一个 WS 一个实例，持久化在内存 / 后续可序列化） |
| Workspace.context（场景层） | `agent.state.systemPrompt` 运行时设置（= ARM Agent.prompt + WS context） |
| Run | 一次 `prompt()` 调用的完整生命周期：`agent_start` ~ `agent_end` |
| Run 流 | `agent.subscribe()` 事件流 → SSE |
| Message | `agent.state.messages`（自动维护） |
| 工具调用 | `state.tools` + `tool_execution_*` 事件 |
| 用户中断 | `agent.abort()` |
| 评分反馈 | `agent_end` 事件触发前端弹窗；不入 Agent state |

### 3.5 重要决策：Agent 实例生命周期

**两个选项**：

| 选项 | 描述 | 优缺点 |
|------|------|--------|
| **A. 每 Run 新建实例** | 每次新 Run 都 `new Agent`，从 SQLite 加载历史 messages 重放 | 简单、易持久化、可重启；冷启动慢 |
| **B. 长驻实例** | Workspace 一个 Agent 实例常驻内存 | 快速；但重启丢上下文、内存占用 |

> **MVP 选 A**：每次 Run 新建 Agent，从 SQLite 加载 Workspace 的 messages 历史。简单可靠。

---

## 4. 信息架构（极简）

```
/                              ← 首页（我的工作空间 + Agent 快捷入口）
/agents                        ← Agent 列表（透传 ARM + 标记是否有 WS）
/agents/:id                    ← Agent 详情 + 该 Agent 下我的 WS 列表
/agents/:id/new-workspace      ← 新建 Workspace 向导
/w/:id                         ← Workspace 主页（默认 chat tab）
/w/:id/chat                    ← 对话 ⭐ 核心页
/w/:id/runs                    ← Run 历史
/w/:id/runs/:runId             ← Run 详情（消息 + 工具 + 评分 + 沉淀按钮）
/w/:id/feedback                ← 评分汇总
/w/:id/settings                ← 改 context / 温度 / 模型
/contribute/:runId             ← 从 Run 沉淀资产向导
/assets                        ← 我沉淀过的资产列表
```

**与 ARM 后台的关系**：
- ARM `(dashboard)` 仍负责资产治理（上传 Skill、创建 Agent、版本绑定）
- 工作站 `(workstation)` 只消费 + 沉淀，不治理

---

## 5. 数据模型（精简版）

### 5.1 复用 ARM（只读）

- `agents`
- `skills`
- `knowledges`
- `agent_skill_bindings`
- `agent_knowledge_bindings`

### 5.2 工作站 SQLite 表

> 命名约定：`ws_` 前缀避免与 ARM 重名（MVP 用独立 SQLite 无所谓，但仍保持习惯）。

#### 5.2.1 `ws_workspace`

```sql
CREATE TABLE ws_workspace (
  id              TEXT PRIMARY KEY,           -- uuid
  agent_id        TEXT NOT NULL,              -- ARM agent.id
  agent_version   TEXT,                      -- 拍快照
  name            TEXT NOT NULL,
  context         TEXT,                      -- 场景描述（追加到 Agent.prompt 之后）
  settings_json   TEXT,                      -- { temperature, model }
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  last_active_at  INTEGER
);
CREATE INDEX idx_ws_workspace_agent ON ws_workspace(agent_id);
CREATE INDEX idx_ws_workspace_active ON ws_workspace(last_active_at DESC);
```

#### 5.2.2 `ws_run`

```sql
CREATE TABLE ws_run (
  id                  TEXT PRIMARY KEY,       -- uuid
  workspace_id        TEXT NOT NULL,
  agent_id            TEXT NOT NULL,          -- 冗余
  agent_version       TEXT NOT NULL,
  title               TEXT,                   -- 自动从首条 user 消息生成
  status              TEXT NOT NULL,          -- loading|streaming|tool_calling|completed|failed|aborted
  -- 快照（保证 Run 可复现）
  system_prompt       TEXT NOT NULL,          -- 三层组装后的完整 prompt
  tools_snapshot_json TEXT,                  -- [{ name, description, schema }]
  skill_bindings_json TEXT,                  -- 当时的 Agent 绑定
  knowledge_bindings_json TEXT,
  -- 指标
  duration_ms         INTEGER,
  ttft_ms             INTEGER,
  prompt_tokens       INTEGER,
  completion_tokens   INTEGER,
  tool_call_count     INTEGER DEFAULT 0,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES ws_workspace(id) ON DELETE CASCADE
);
CREATE INDEX idx_ws_run_workspace ON ws_run(workspace_id, created_at DESC);
```

#### 5.2.3 `ws_message`

```sql
CREATE TABLE ws_message (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  seq             INTEGER NOT NULL,
  role            TEXT NOT NULL,              -- user|assistant|tool|system
  content         TEXT,
  tool_call_id    TEXT,
  tool_name       TEXT,
  created_at      INTEGER NOT NULL,
  UNIQUE(run_id, seq),
  FOREIGN KEY (run_id) REFERENCES ws_run(id) ON DELETE CASCADE
);
CREATE INDEX idx_ws_message_run ON ws_message(run_id, seq);
```

#### 5.2.4 `ws_event`

```sql
CREATE TABLE ws_event (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  seq             INTEGER NOT NULL,
  type            TEXT NOT NULL,              -- tool_call_start|tool_call_end|knowledge_hit|error|state_change
  payload_json    TEXT,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES ws_run(id) ON DELETE CASCADE
);
CREATE INDEX idx_ws_event_run ON ws_event(run_id, seq);
```

#### 5.2.5 `ws_feedback`

```sql
CREATE TABLE ws_feedback (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  rating          INTEGER,                    -- 1-5（可空）
  is_helpful      INTEGER,                    -- 1=👍 0=👎 null=未评
  comment         TEXT,
  tags_json       TEXT,                       -- ['准确', '有帮助']
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES ws_run(id) ON DELETE CASCADE
);
CREATE INDEX idx_ws_feedback_run ON ws_feedback(run_id);
```

#### 5.2.6 `ws_asset_share`（沉淀记录）

```sql
CREATE TABLE ws_asset_share (
  id              TEXT PRIMARY KEY,
  from_run_id     TEXT NOT NULL,
  asset_type      TEXT NOT NULL,              -- skill|knowledge|agent
  arm_asset_id    TEXT,                       -- ARM 侧创建后的资产 id
  arm_asset_name  TEXT,
  status          TEXT NOT NULL,              -- pending|created|failed
  error_message   TEXT,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (from_run_id) REFERENCES ws_run(id) ON DELETE CASCADE
);
```

#### 5.2.7 `ws_config`（全局配置，MVP 简单 key-value）

```sql
CREATE TABLE ws_config (
  key             TEXT PRIMARY KEY,
  value           TEXT,
  updated_at      INTEGER NOT NULL
);
-- 例如：
-- (provider, "openai")
-- (base_url, "https://api.openai.com/v1")
-- (api_key, "sk-xxx")
-- (default_model, "gpt-4o")
-- (arm_base_url, "http://localhost:3000")
```

---

## 6. Workspace 三层 Prompt 组装

每次新建 Agent 实例时，组装 systemPrompt：

```
Layer 1: ARM Agent.prompt
  ↓
Layer 2: Workspace.context（用户在新建 WS 时写的场景描述）
  ↓
Layer 3: 运行时动态上下文（每次 prompt 前由 transformContext 注入）
  - 当前 Agent 版本绑定的 Skill 摘要列表
  - 当前 Agent 版本绑定的 Knowledge 摘要列表
  - Workspace 的 settings（温度等）→ 转 model options
  ↓
Layer 4: 历史 messages（从 ws_message 加载）
  ↓
Layer 5: 用户当前消息
```

**实现**：

```typescript
function buildSystemPrompt(agent: ArmAgent, workspace: WsWorkspace): string {
  return [
    agent.prompt,
    workspace.context ? `\n\n## 当前工作场景\n${workspace.context}` : "",
  ].filter(Boolean).join("\n");
}

const runner = new AgentRunner({
  workspaceId,
  systemPromptFn: () => buildSystemPrompt(armAgent, workspace),
  toolsFn: () => buildTools(armAgent),          // 包含 arm_cli + ARM Skill 工具
  historyFn: () => loadMessages(workspaceId),   // 加载历史
  transformContext: async (messages) => {
    // 每次 prompt 前注入当前 Skill/Knowledge 摘要
    const ctx = await loadWorkspaceContextSnapshot(workspaceId);
    return [...messages, ...ctx.injections];
  },
});
```

---

## 7. CLI 作为 Agent 的一个 Tool（核心特性 ⭐）

### 7.1 设计动机

让 Agent **具备自我发现 / 自我加载能力**：
- 用户对话中提到"用 X skill"，Agent 主动 `arm skill info X` 看一眼
- Agent 完成任务后想沉淀，主动 `arm skill upload <path>`
- 知识库检索：`arm knowledge search "退款流程"`

### 7.2 Tool 定义

```typescript
// workstation/src/execution/tools/arm-cli.ts
import { Type } from "typebox";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export const armCliTool = {
  name: "arm_cli",
  label: "ARM CLI",
  description: [
    "通过 ARM CLI 命令行查询与操作 ARM 资源（Agent、Skill、Knowledge）。",
    "常用命令：",
    "  arm skill ls                        - 列出所有 skill",
    "  arm skill info <name>              - 查看 skill 详情",
    "  arm skill search <keyword>         - 搜索 skill",
    "  arm skill download <name>          - 下载 skill 到本地 ~/.arm/skills/<name>",
    "  arm knowledge ls                   - 列出所有 knowledge",
    "  arm knowledge info <name>          - 查看 knowledge 详情",
    "  arm knowledge search <keyword>     - 搜索 knowledge",
    "  arm agent ls                       - 列出所有 agent",
    "  arm agent info <name>              - 查看 agent 详情",
    "传 subcommand + args 即可，不要带 `arm` 前缀。",
  ].join("\n"),
  parameters: Type.Object({
    subcommand: Type.String({
      description: "完整的 arm 子命令（不含 'arm' 前缀），例如 'skill info log-parser'",
    }),
    cwd: Type.Optional(Type.String({ description: "执行目录" })),
  }),
  execute: async (toolCallId, params, signal) => {
    const args = params.subcommand.trim().split(/\s+/);
    try {
      const { stdout, stderr } = await exec(
        "arm",
        args,
        {
          cwd: params.cwd || process.cwd(),
          timeout: 60_000,
          signal,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      return {
        content: [
          { type: "text", text: stdout || "(no stdout)" },
          ...(stderr ? [{ type: "text", text: `[stderr]\n${stderr}` }] : []),
        ],
        details: { exitCode: 0 },
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `[error]\n${e.message}\n${e.stderr || ""}` }],
        details: { exitCode: e.code ?? 1 },
      };
    }
  },
};
```

### 7.3 安全约束（MVP 妥协）

- ❌ 不做白名单（用户自用，可控）
- ✅ 但记录所有 tool_call 到 `ws_event`，审计有据可查
- ❌ 不做沙箱（后续可加）

### 7.4 典型场景

```
用户：帮我把这次的 bug 分析沉淀成 skill
Agent 调用 arm_cli subcommand="skill upload /tmp/bug-analyzer.zip"
Agent：已上传为 skill "bug-analyzer"，ARM 资产 ID xxx
```

---

## 8. 资产沉淀流程

### 8.1 用户视角

```
Run 完成后 → 弹出"沉淀这次结果"按钮
   → 跳转到 /contribute/:runId
   → 三选一：Skill | Knowledge | Agent
   → 自动从 Run 提取：
       Skill:     提取 Run 中使用/产生的脚本 → 打包成 ZIP
       Knowledge: 提取 Run 最后 1-2 轮 assistant 回答 → 转 Markdown
       Agent:     复制 Agent.prompt + WS.context + 绑定 → 提交为新 Agent Draft
   → 用户补充：名称 / 描述 / 标签
   → 点击 [发布]
       └→ 工作站后端调 ARM API 创建资产
       └→ 记录到 ws_asset_share
       └→ 跳回 Run 详情，显示"已沉淀为 Skill xxx"
```

### 8.2 调用 ARM API

| 沉淀类型 | ARM API |
|----------|---------|
| Skill | `POST /api/v1/skills`（ZIP 上传） |
| Knowledge | `POST /api/v1/knowledges` |
| Agent | `POST /api/v1/agents` |

### 8.3 自动提取（简化版）

| 类型 | 提取策略 |
|------|---------|
| Skill | 让 Agent 在 Run 末尾主动把代码写到一个约定路径（`/tmp/ws-skill/`），然后 ZIP 打包 |
| Knowledge | 取 Run 中所有 assistant message，按出现顺序拼成 Markdown |
| Agent | 模板化：`<WS.context>\n\n<Agent.prompt>\n\n## 绑定\n<skill bindings>\n<knowledge bindings>` |

> MVP 不做智能提取，只做"诚实搬运"。后续可加 LLM 提炼。

---

## 9. 评分反馈闭环

### 9.1 触发时机

- Run 完成（`agent_end` 事件）→ 弹窗
- 用户主动从 Run 详情页触发

### 9.2 反馈形式

```
┌──────────────────────────────────────────────────┐
│ 这个回答怎么样？                                  │
│                                                  │
│  [👍 有用]  [👎 没用]                              │
│                                                  │
│  评分:  ☆ ☆ ☆ ☆ ☆                                │
│                                                  │
│  评论: [________________________________]         │
│                                                  │
│  标签: [准确] [有帮助] [慢] [不准确] [跳出思路]     │
│                                                  │
│  [跳过]                            [提交反馈]      │
└──────────────────────────────────────────────────┘
```

### 9.3 数据流向

```
前端 POST /api/v1/ws/runs/:runId/feedback
   → SQLite ws_feedback 表
   → 同步到 ARM? （MVP 暂不同步，先存本地）
```

### 9.4 反馈聚合（MVP 简单版）

- Agent 详情页：平均评分 / 👍率 / 标签云
- Run 列表：可按评分过滤
- **后续**：定期把 feedback 同步到 ARM，让 Agent 详情（ARM 侧）显示

---

## 10. 关键交互流程

### 10.1 完整流程图

```
[1] 打开工作站 /             (无登录，直接进)
        ↓
[2] /agents                  → 看 ARM 中所有 Agent
        ↓ 点击某个 Agent
[3] /agents/:id              → 详情 + 该 Agent 下我的 WS 列表
        ↓ [+ 新建工作空间]
[4] /agents/:id/new-workspace → 填写 name + context → 创建
        ↓ 自动跳转到
[5] /w/:id/chat              → 对话页（SSE 已连）
        ↓ 输入消息
[6] Agent 执行               → 事件流 → SSE → 实时渲染
        ↓ Run 完成
[7] 弹窗：评分 / 沉淀 / 关掉
        ↓ 用户选 [沉淀为 Knowledge]
[8] /contribute/:runId       → 选类型 + 填名称 → 发布
        ↓ POST /api/v1/ws/contribute
[9] 工作站调 ARM API 创建资产 → 写 ws_asset_share → 返回成功
        ↓
[10] 回到 Run 详情，显示"已沉淀为 Knowledge xxx"
```

### 10.2 SSE 事件协议

```
event: run.start        data: { runId, agentId, agentVersion }
event: context.loaded   data: { skills: [...], knowledges: [...] }
event: message.user     data: { seq, content }
event: message.delta    data: { seq, delta }
event: tool.call.start  data: { toolName, args }
event: tool.call.end    data: { toolName, result, durationMs }
event: message.done     data: { seq, finishReason, usage }
event: run.done         data: { status, durationMs, totalUsage }
event: error            data: { code, message }
```

---

## 11. API 设计（MVP 子集）

### 11.1 ARM 侧调用（arm-client）

```typescript
// workstation/src/arm-client/client.ts
class ArmClient {
  listAgents(): Promise<Agent[]>
  getAgent(id: string): Promise<AgentDetail>
  listSkills(query?): Promise<Skill[]>
  getSkill(name: string): Promise<SkillDetail>
  downloadSkill(name: string): Promise<Buffer>
  listKnowledges(query?): Promise<Knowledge[]>
  getKnowledge(name: string): Promise<KnowledgeDetail>
  
  // 资产沉淀
  createSkill(zipPath: string, metadata): Promise<{ id, name }>
  createKnowledge(markdown: string, metadata): Promise<{ id, name }>
  createAgent(payload): Promise<{ id, name }>
}
```

### 11.2 工作站自身 API

| Method | Path | 说明 |
|--------|------|------|
| **Workspace** |  |  |
| GET | `/api/ws/workspaces` | 我的 WS 列表（按 last_active_at DESC） |
| POST | `/api/ws/workspaces` | 创建 |
| GET | `/api/ws/workspaces/:id` | 详情（含 Agent 概要） |
| PUT | `/api/ws/workspaces/:id` | 更新 name/context/settings |
| DELETE | `/api/ws/workspaces/:id` | 归档 |
| **Agent** |  |  |
| GET | `/api/ws/agents` | Agent 列表（透传 ARM + 我的 WS 数） |
| GET | `/api/ws/agents/:id` | Agent 详情 + 我的 WS |
| **Run** |  |  |
| POST | `/api/ws/workspaces/:id/runs` | 新建 Run + 首条消息 |
| GET | `/api/ws/runs/:id` | Run 详情 |
| GET | `/api/ws/runs/:id/messages` | 消息列表 |
| GET | `/api/ws/runs/:id/events` | 事件列表 |
| GET | `/api/ws/runs/:id/stream` | **SSE** 流 |
| POST | `/api/ws/runs/:id/messages` | 追加用户消息（续接 Run） |
| POST | `/api/ws/runs/:id/abort` | 中断 |
| GET | `/api/ws/workspaces/:id/runs` | Run 历史 |
| **Feedback** |  |  |
| POST | `/api/ws/runs/:id/feedback` | 提交评分 |
| GET | `/api/ws/workspaces/:id/feedback` | WS 反馈汇总 |
| **Contribute** |  |  |
| POST | `/api/ws/runs/:id/contribute` | 沉淀（自动从 Run 提取 + 调 ARM API） |
| GET | `/api/ws/assets` | 我的沉淀列表 |
| **Config** |  |  |
| GET | `/api/ws/config` | 读全局配置 |
| PUT | `/api/ws/config` | 写全局配置 |

### 11.3 Run 创建时序

```
POST /api/ws/workspaces/:id/runs
Body: { firstMessage: string }

服务端：
  1. 从 SQLite 加载 ws_workspace + ws_message 历史
  2. 从 ARM 拉 Agent 详情 + 绑定
  3. 三层组装 systemPrompt
  4. 构造 tools = [arm_cli_tool, ...skill_tools]
  5. new Agent({ initialState: {...} })
  6. 订阅事件 → SSE
  7. await agent.prompt(firstMessage)
  8. 关闭 SSE
```

---

## 12. UI 草图（MVP 极简）

### 12.1 首页 `/`

```
┌─────────────────────────────────────────────────────────────┐
│ 🤖 Agent Workstation                              ⚙ 设置    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📂 我的工作空间 (3)                          [+ 新建 →]     │
│                                                             │
│ ┌──────────────────────┐ ┌──────────────────────┐           │
│ │ 🤖 Bug 分类专员       │ │ 🌐 翻译专员           │           │
│ │ 📋 订单系统 Bug分类    │ │ 📋 古文今译           │           │
│ │ 12 次对话 · 2h 前     │ │ 5 次对话 · 昨天       │           │
│ │ [进入]                │ │ [进入]                │           │
│ └──────────────────────┘ └──────────────────────┘           │
│                                                             │
│ 🤖 Agent 员工 (5)                          [全部 →]         │
│                                                             │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │
│ │ 🐛  │ │ 🌐  │ │ ✍️  │ │ 📊  │ │ +   │                  │
│ │ Bug │ │ 翻译│ │ 文案│ │ 数据│ │ 探索│                  │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Agent 详情 `/agents/:id`

```
┌─────────────────────────────────────────────────────────────┐
│ ←  Agent 员工                                               │
├─────────────────────────────────────────────────────────────┤
│ 🐛 Bug 分类专员                                              │
│ 帮我把堆栈 / 日志自动归类                                     │
│ ★★★★☆ 4.6 (212) · v2.3.0 · 研发部                            │
│                                                              │
│ 已加载资源                                                   │
│ • Skill: log-parser v1.2.0                                  │
│ • Skill: stack-trace v0.9.1                                 │
│ • Knowledge: 故障知识库 v2.1.0                               │
│                                                              │
│ ════════════════════════════════════════════════════════     │
│                                                              │
│ 📂 我的工作空间 (3)              [+ 新建工作空间]            │
│                                                              │
│ ┌──────────────────────┐ ┌──────────────────────┐           │
│ │ 📋 订单系统 Bug分类    │ │ 🐛 支付链路事故       │           │
│ │ 12 次对话 · 2h 前     │ │ 5 次对话 · 昨天       │           │
│ │ context: 只看订单日志  │ │ context: 只看支付链路  │           │
│ │ [进入]                │ │ [进入]                │           │
│ └──────────────────────┘ └──────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 12.3 Workspace 对话 `/w/:id/chat` ⭐

```
┌─────────────────────────────────────────────────────────────┐
│ ← WS列表    🤖 Bug 分类专员 · 📋 订单系统 Bug分类     ⚙ 设置 │
├─────────────────────────────────────────────────────────────┤
│ Chat  | Runs | Feedback | Settings                          │
│                                                              │
│ 📋 上下文                                                    │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 你是一名 Bug 分类专员...                              │    │
│ │ ────────────────                                      │    │
│ │ 当前工作场景:                                          │    │
│ │ 只看订单系统日志，只输出 P0/P1/P2 三个等级             │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ────────────────────────────                                │
│ [User] 帮我看这段报错...                                     │
│                                                              │
│ [Assistant] 正在调用 arm_cli ...                             │
│             [工具调用卡片]                                   │
│             根据日志内容 ...                                  │
│             [Markdown 回答]                                 │
│                                                              │
│ ────────────────────────────                                │
│ [输入框...                                ] [发送 ➤]        │
├─────────────────────────────────────────────────────────────┤
│ 👍 有用  👎 没用  ⭐⭐⭐⭐⭐  📤 沉淀                            │
└─────────────────────────────────────────────────────────────┘
```

### 12.4 沉淀向导 `/contribute/:runId`

```
┌─────────────────────────────────────────────────────────────┐
│ ← 返回 Run   沉淀这次结果为资产                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 沉淀为 *                                                      │
│                                                              │
│   ○ Skill       提取本次 Run 中用到的脚本/代码                │
│   ● Knowledge   提取本次 Run 的关键回答为 Markdown            │
│   ○ Agent       复制 Agent.prompt + WS.context 为新 Agent     │
│                                                              │
│ 自动提取预览:                                                │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ # 订单系统 Bug 分类结果                              │    │
│ │                                                      │    │
│ │ ## 故障模块: 订单服务                                 │    │
│ │ ## 现象: NullPointerException ...                    │    │
│ │ ## 初步根因: ...                                     │    │
│ │ ## 建议: ...                                         │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ 名称 * [订单系统常见报错分类                              ]    │
│ 描述   [整理订单系统常见报错的分类与定级规则               ]    │
│                                                              │
│ 标签   [订单] [P0/P1/P2] [报错]  +                          │
│                                                              │
│ 发布到 *  ◉ 公共 (所有人可见)                                │
│         ○ 私有 (仅自己)                                      │
│                                                              │
│                       [取消]            [发布到 ARM →]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. 配置与运行

### 13.1 环境变量 / 配置文件

```yaml
# workstation/config.yaml (或 .env)
llm:
  provider: openai              # 固定 OpenAI 兼容
  baseUrl: https://api.openai.com/v1
  apiKey: sk-xxx
  defaultModel: gpt-4o

arm:
  baseUrl: http://localhost:3000   # ARM 后端地址
  apiKey: arm_xxx                  # 暂时不用，但留位

server:
  port: 4000
  host: 0.0.0.0

db:
  path: ./data/workstation.db
```

### 13.2 启动

```bash
cd workstation
bun install
bun run src/server.ts
# → http://localhost:4000
```

### 13.3 前端开发

```bash
cd workstation/web  # 或独立 SPA 项目
bun run dev
# → http://localhost:5173 (proxy /api → 4000)
```

---

## 14. 目录与文件清单（MVP 一次性产出）

```
workstation/
├── package.json
├── tsconfig.json
├── README.md
├── config.example.yaml
├── data/                          # SQLite 落盘
├── src/
│   ├── server.ts                  # 启动入口（Hono）
│   ├── config.ts                  # 读 yaml/env
│   ├── db/
│   │   ├── sqlite.ts
│   │   ├── migrate.ts
│   │   └── repos/
│   │       ├── workspace.repo.ts
│   │       ├── run.repo.ts
│   │       ├── message.repo.ts
│   │       ├── event.repo.ts
│   │       ├── feedback.repo.ts
│   │       └── asset-share.repo.ts
│   ├── arm-client/
│   │   └── client.ts
│   ├── execution/
│   │   ├── agent-runner.ts        # 封装 Agent 生命周期
│   │   ├── context-builder.ts     # 三层 Prompt 组装
│   │   ├── skill-tools.ts         # 按 ARM Skill 构建 tool
│   │   └── tools/
│   │       └── arm-cli.ts         # CLI 作为 Tool ⭐
│   ├── routes/
│   │   ├── workspaces.ts
│   │   ├── runs.ts                # 含 SSE
│   │   ├── feedback.ts
│   │   ├── contribute.ts
│   │   └── config.ts
│   └── web/
│       └── (或独立 web 目录)
└── web/                            # 可选：独立前端项目
    ├── package.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── pages/
        └── components/
```

---

## 15. 实施 Roadmap（MVP 1 周跑通 + 后续迭代）

### Phase M0：环境与依赖（0.5 天）

- [ ] 新建 `workstation/` 子包，初始化 `package.json`、`tsconfig.json`
- [ ] 安装：`@earendil-works/pi-agent-core` `@earendil-works/pi-ai` `better-sqlite3` `hono` `typebox`
- [ ] SQLite 迁移脚本（含 6 张表）
- [ ] config 加载

### Phase M1：ARM 客户端 + Agent 列表（0.5 天）

- [ ] `arm-client/client.ts`（基于 fetch）
- [ ] `/api/ws/agents` 路由（透传 ARM）
- [ ] `/api/ws/agents/:id` 路由
- [ ] 前端首页 + Agent 列表 + 详情页（只读）

### Phase M2：Workspace CRUD（0.5 天）

- [ ] `workspace.repo.ts`
- [ ] `/api/ws/workspaces*` 路由
- [ ] 新建 Workspace 向导（前端 4 步：选 Agent → 命名 → context → 完成）
- [ ] Agent 详情页 + 我的 WS 列表 + [+新建]

### Phase M3：对话核心（2 天）⭐ 关键路径

- [ ] `execution/agent-runner.ts`：封装 `new Agent()`、订阅、prompt、abort
- [ ] `execution/context-builder.ts`：三层 Prompt 组装
- [ ] `execution/tools/arm-cli.ts`
- [ ] `execution/skill-tools.ts`：按 ARM Skill 注册为 tool
- [ ] `routes/runs.ts`：创建 Run、消息、SSE、abort
- [ ] 前端对话页：消息流渲染 + 工具调用卡片

### Phase M4：评分反馈（0.5 天）

- [ ] `feedback.repo.ts`
- [ ] `/api/ws/runs/:id/feedback`
- [ ] Run 详情 / 列表显示评分

### Phase M5：资产沉淀（0.5 天）

- [ ] `asset-share.repo.ts`
- [ ] `routes/contribute.ts`：选类型 + 调 ARM API
- [ ] 前端沉淀向导
- [ ] ARM 资产创建（Skill ZIP / Knowledge MD / Agent JSON）

### Phase M6：打磨（0.5 天）

- [ ] Run 历史 / 详情页
- [ ] 反馈汇总
- [ ] 错误处理 + 重试
- [ ] 简易 README

### 总计：约 5 天可跑通 MVP

### 后续迭代（出 MVP 后）

- W1：文件上传 + RAG
- W2：多用户 + 鉴权
- W3：成员协作 / 权限
- W4：成果广场 / Fork
- W5：推荐算法 / 部门排行
- W6：飞书 IM 打通

---

## 16. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `pi-agent-core` API 不稳（早期版本） | 锁版本到 0.79.x；用 `Agent` 类高级 API 不碰低阶 `agentLoop` |
| SQLite 写并发 | MVP 单用户场景无并发；后续上 WAL |
| SSE 断线 | 客户端自动重连 + `Last-Event-ID` 续传 |
| LLM 超时 / 失败 | 自动重试 1 次 + 暴露 abort |
| CLI Tool 慢 | 60s timeout；前端显示"工具调用中"加载态 |
| 资产沉淀失败 | 失败回写 `ws_asset_share.status=failed` + 错误信息，前端可重试 |

---

## 17. 一句话总结

> **Agent Workstation v3 MVP** = **独立子包 + SQLite + 无鉴权 + 基于 pi-agent-core SDK**，
> 一个 `bun run` 起服务，一个前端 SPA，5 天跑通"**选 Agent → 建 Workspace → 对话（带 arm_cli 工具） → 评分 → 沉淀**"完整闭环。