# Agent Workstation

> 与 ARM 数据强绑定的 **独立 Agent 工作站**。
> 让员工 **找到 Agent → 进入工作空间 → 持续对话 → 沉淀资产**。

基于 [`@earendil-works/pi-agent-core`](https://github.com/earendil-works/pi) + `bun:sqlite` + Hono，5 分钟跑通最小闭环。

---

## 1. 功能特性（MVP）

- ✅ **Agent 员工选择** —— 列出 ARM 中所有 Agent，进入详情
- ✅ **创建工作空间** —— 给某个 Agent 起名 + 写场景描述，进入隔离对话
- ✅ **对话（SSE 流式）** —— 实时打字机效果、工具调用卡片、历史回放
- ✅ **arm_cli Tool** —— Agent 可调用 ARM CLI 自助加载 Skill / 检索 Knowledge
- ✅ **评分反馈** —— 👍/👎 / 1-5 星 / 评论 / 沉淀
- ✅ **资产沉淀** —— 从 Run 提取 → 调用 ARM API 创建 Knowledge / Agent
- ❌ 不做：鉴权 / 权限 / 协作成员 / 模板市场 / RAG 上传 / 飞书 IM

详见 [`../docs/AGENT-WORKSTATION-DESIGN.md`](../docs/AGENT-WORKSTATION-DESIGN.md)。

---

## 2. 技术栈

| 组件 | 选型 |
|------|------|
| Runtime | **Bun 1.3+**（必需，因使用 `bun:sqlite`） |
| HTTP | Hono + `@hono/node-server` |
| DB | `bun:sqlite`（本地单文件） |
| Agent SDK | `@earendil-works/pi-agent-core` |
| LLM | `@earendil-works/pi-ai`（OpenAI 兼容） |
| 前端 | 原生 JS SPA（无构建），单 HTML + 一个 main.js |

---

## 3. 快速开始

### 3.1 安装

```bash
cd workstation
bun install
bun pm trust --all   # 信任 native binding postinstall
```

### 3.2 配置

复制 `config.example.yaml` → `config.yaml`：

```yaml
llm:
  provider: openai
  baseUrl: https://api.openai.com/v1
  apiKey: sk-xxx                  # 必填
  defaultModel: gpt-4o

arm:
  baseUrl: http://localhost:3000  # ARM backend 地址
  apiKey: ""                       # MVP 不需要鉴权，留空即可

server:
  port: 4000
  host: 0.0.0.0
```

也可以用环境变量：

```bash
export WS_LLM_API_KEY=sk-xxx
export WS_LLM_BASE_URL=https://api.openai.com/v1
export WS_LLM_MODEL=gpt-4o
export WS_ARM_BASE_URL=http://localhost:3000
```

### 3.3 启动 ARM Backend

工作站在 ARM backend 之上运行，需要先启动 ARM：

```bash
cd ../backend
pnpm install
pnpm dev
# → ARM API: http://localhost:3000
```

> 如果暂时没有 ARM backend，可以用 mock 启动一个：
>
> ```bash
> cd workstation
> bun run scripts/mock-arm.ts 3000
> # mock ARM 暴露 3 个测试 Agent
> ```

### 3.4 启动工作站

```bash
cd workstation
bun run src/server.ts
# → 工作站: http://localhost:4000
```

打开浏览器访问 `http://localhost:4000`。

### 3.5 类型检查

```bash
bun run typecheck
```

---

## 4. 使用流程

```
[1] 打开 http://localhost:4000
   → 首页：我的工作空间 + Agent 员工

[2] 点 [Agent 员工] → 选一个 Agent (例如 "Bug 分类专员")

[3] 点 [+ 新建工作空间]
   → 命名（如 "订单系统 Bug分类"）
   → 写场景描述（追加到 Agent 身份之后）

[4] 进入对话
   → 输入消息
   → SSE 流式渲染 Agent 回答
   → 工具调用会显示 🔧 卡片

[5] Agent 员工在对话中可以调用 ARM CLI：
   - "帮我查一下 log-parser 这个 skill 的详情"
     → Agent 自动调用 `arm_cli skill info log-parser`
   - "把这次结果沉淀成 Knowledge"
     → Agent 自动调用 `arm_cli skill upload ...`

[6] Run 完成后评价：
   - 👍 有用 / 👎 没用
   - 1-5 星 + 评论

[7] 沉淀资产：
   - 点 [📤 沉淀]
   - 选 Skill / Knowledge / Agent
   - 自动从 Run 提取 → 调 ARM API 发布
```

---

## 5. 数据模型

7 张 SQLite 表，文件：`data/workstation.db`

| 表 | 用途 |
|----|------|
| `ws_workspace` | 工作空间（Agent + 场景描述 + 配置） |
| `ws_run` | 一次 Run（包含 system prompt 快照、tools 快照） |
| `ws_message` | 消息流 |
| `ws_event` | 执行事件（工具调用、状态变更、错误） |
| `ws_feedback` | 评分与反馈 |
| `ws_asset_share` | 沉淀记录（成功/失败） |
| `ws_config` | 全局配置（key-value） |

迁移脚本自动运行，启动时执行。

---

## 6. 项目结构

```
workstation/
├── package.json
├── tsconfig.json
├── config.example.yaml
├── data/                       # SQLite 落盘
├── public/                     # 前端 SPA
│   ├── index.html
│   ├── styles.css
│   └── main.js
├── scripts/
│   └── mock-arm.ts             # 本地 mock ARM backend
└── src/
    ├── server.ts               # Hono 启动入口
    ├── config.ts               # 配置加载
    ├── types.ts                # 共享类型
    ├── db/
    │   ├── sqlite.ts
    │   ├── migrate.ts
    │   └── repos/
    │       ├── workspace.repo.ts
    │       ├── run.repo.ts
    │       ├── message.repo.ts
    │       ├── event.repo.ts
    │       ├── feedback.repo.ts
    │       ├── asset-share.repo.ts
    │       └── config.repo.ts
    ├── arm-client/
    │   └── client.ts           # ARM REST 客户端
    ├── execution/
    │   ├── agent-runner.ts     # Agent 生命周期封装
    │   ├── context-builder.ts  # 三层 Prompt 组装
    │   ├── skill-tools.ts      # ARM Skill → Tool
    │   └── tools/
    │       └── arm-cli.ts      # arm_cli 作为 Tool ⭐
    └── routes/
        ├── workspaces.ts
        ├── agents.ts
        ├── runs.ts             # 含 SSE
        ├── feedback.ts
        ├── contribute.ts
        └── config.ts
```

---

## 7. API 概览

所有 API 挂在 `/api/ws/*`，响应格式 `{ ok, data, msg }`。

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/ws/agents` | Agent 列表（透传 ARM + 我的 WS 数） |
| GET | `/api/ws/agents/:id` | Agent 详情 + 我的 WS |
| GET | `/api/ws/workspaces` | 我的工作空间列表 |
| POST | `/api/ws/workspaces` | 创建 |
| GET | `/api/ws/workspaces/:id` | 详情 |
| PUT | `/api/ws/workspaces/:id` | 更新 |
| DELETE | `/api/ws/workspaces/:id` | 删除 |
| POST | `/api/ws/workspaces/:id/runs` | **创建 Run + 流式对话** |
| GET | `/api/ws/workspaces/:id/runs` | Run 历史 |
| GET | `/api/ws/runs/:id` | Run 详情 + 消息 + 事件 |
| POST | `/api/ws/runs/:id/abort` | 中断 |
| POST | `/api/ws/runs/:id/feedback` | 提交评分 |
| POST | `/api/ws/runs/:id/contribute` | 沉淀为资产 |
| GET | `/api/ws/runs/:id/extract` | 预览沉淀内容 |
| GET | `/api/ws/assets` | 我沉淀过的资产 |
| GET | `/api/ws/config` | 全局配置 |
| GET | `/health` | 健康检查 |

---

## 8. SSE 事件协议

`POST /api/ws/workspaces/:id/runs` 返回 `text/event-stream`：

```
event: run.created
data: {"runId":"..."}

event: context.loaded
data: {"agent":{...}, "skillBindings":[], "knowledgeBindings":[]}

event: message.delta
data: {"delta":"..."}

event: tool.call.start
data: {"toolName":"arm_cli", "args":{...}}

event: tool.call.end
data: {"toolName":"arm_cli", "result":{...}}

event: message.done
data: {"finishReason":"stop", "usage":{...}}

event: run.done
data: {"status":"completed", "durationMs":1234}
```

---

## 9. Workspace 三层 Prompt

每次 Run 的 system prompt 由三层组装：

```
Layer 1: ARM Agent.prompt           ← 身份（不可覆盖）
Layer 2: Workspace.context          ← 场景（用户写）
Layer 3: 运行时动态上下文            ← Skill/Knowledge 摘要
```

实现见 `src/execution/context-builder.ts`。

---

## 10. arm_cli Tool 设计

Agent 员工具备"自我发现 / 自我加载"能力：

```
User: 帮我用 log-parser 分析这段日志
  ↓
Agent 思考：需要先了解 log-parser 是啥
  ↓
Agent 调用 tool: arm_cli { subcommand: "skill info log-parser" }
  ↓
执行: arm skill info log-parser
  ↓
返回 Skill 详情
  ↓
Agent 继续基于详情分析日志
```

实现见 `src/execution/tools/arm-cli.ts`。

---

## 11. 常见问题

### 11.1 启动报错 `better-sqlite3 is not yet supported`

我们改用了 `bun:sqlite`，请确认：
1. 使用 Bun 1.3+（不要用 Node）
2. `package.json` 中已无 `better-sqlite3` 依赖

### 11.2 `/api/ws/agents` 返回 502 ARM 不可达

ARM backend 没起来，或 `config.yaml` 的 `arm.baseUrl` 配错。

可临时用 `bun run scripts/mock-arm.ts 3000` 启动 mock。

### 11.3 LLM 调用失败

确认 `WS_LLM_API_KEY` 已设置，且 `WS_LLM_BASE_URL` 指向正确的 OpenAI 兼容 endpoint。

### 11.4 TypeScript 类型错误

```bash
bun run typecheck
```

如果报 `allowImportingTsExtensions` 相关错误，确认 `tsconfig.json` 已包含该选项。

---

## 12. 后续迭代

- [ ] 文件上传 + RAG 检索
- [ ] 多用户 / 鉴权
- [ ] 成员协作 / Workspace 权限
- [ ] 成果广场 / Fork Workspace
- [ ] 推荐算法 / 部门排行
- [ ] 飞书 IM 打通
- [ ] Docker 镜像 / 一键部署

详见 [`../docs/AGENT-WORKSTATION-DESIGN.md`](../docs/AGENT-WORKSTATION-DESIGN.md) §15。