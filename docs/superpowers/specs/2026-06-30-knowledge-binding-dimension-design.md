# 知识飞轮 v1：绑定维度（必备业务知识 / 工作经验）

- 日期：2026-06-30
- 作者：刘锟 + Claude
- 状态：设计定稿，待评审
- 关联：`docs/AGENT-WORKSTATION-DESIGN.md`、`docs/DESIGN.md`、`AGENTS.md`

## 1. 背景与动机

当前 `Agent ↔ Knowledge` 的关系只有"简单绑定"：`AgentKnowledgeBinding` 把一篇知识挂到某个 Agent 上，workstation 运行时（`context-builder.ts` Layer 3）把所有已绑定知识的**名字**注入 system prompt，Agent 通过 `arm_cli` 自取全文（README 明说"MVP 用 Prompt 注入替代 RAG"）。

问题：
- 绑定没有区分"重要性 / 加载方式"。所有绑定一视同仁，要么都进 prompt 名单，要么都不进。
- 知识库一旦变大，Agent 上下文会爆炸；但又没法把"必须掌握"的核心知识可靠地放进 Agent 环境。
- 反馈机制（`KnowledgeFeedback`、低分通知作者）已存在，但因为知识没被真正"用起来"，飞轮转不动。

目标用户诉求：**先实现知识飞轮**。通过给绑定增加一个维度，让大规模知识库既不撑爆上下文、又能真正被 Agent 使用，从而让上传→使用→反馈→改进的循环跑起来。

## 2. 目标与非目标

### 目标
1. 给 `AgentKnowledgeBinding` 增加 `kind` 维度：`essential`（必备业务知识）/ `experience`（工作经验）。
2. `essential`：运行时**下载到 Agent 工作区**（`knowledges/<name>.md` 文件），始终可读——"员工上岗必修"。
3. `experience`：**不进环境**，Agent 排障时按需检索——"团队踩坑沉淀"，规模可无限增长。
4. 跑通知识飞轮：上传 → 分级绑定 → 使用 → 反馈回流 → 改进/升降级。
5. 向后兼容：老绑定默认 `experience`，行为不变。

### 非目标（明确不做，留后续阶段）
- RAG 分块 / embedding / 语义检索。`experience` 的 v1 检索用现有关键字检索（`GET /knowledges?search=`）。
- `retrievalConfig{topK, similarityThreshold}` 仍保持休眠——下一阶段做语义检索时再激活，届时服务于 `experience` 池。
- 多答案 / 投票 / 声誉等 Stack Overflow 式社交 UI。
- `essential` 内容的 chunking 或摘要（v1 整篇下载）。

## 3. 核心设计：绑定维度 `kind`

| kind | 中文 | 运行时行为 | 池子定位 | 规模 |
|---|---|---|---|---|
| `essential` | 必备业务知识 | 下载到 Agent 工作区文件，始终可读 | 核心/必修，按 Agent 策展 | 小而精（1~5 篇） |
| `experience` | 工作经验 | 不下载；按需检索 | 踩坑经验，自由增长 | 大而广 |

**默认值 `experience`**：老绑定维持现状（只出现在 prompt 名单、按需自取），不产生行为突变。`essential` 为显式 opt-in。

**遵守 append-only 绑定约定**（`AGENTS.md` §6.3）：`kind` 只是绑定上的新列；修改某个绑定的维度 = 绑一个新版本，绝不 update / 硬删旧行。

## 4. 数据模型变更

文件：`backend/prisma/schema.prisma`

`AgentKnowledgeBinding` 新增字段：
```prisma
model AgentKnowledgeBinding {
  id              String    @id @default(uuid())
  agentId         String
  knowledgeId     String    @map("knowledge_id")
  version         String
  kind            String    @default("experience") @map("kind")   // 新增：essential | experience
  retrievalConfig Json?     @map("retrieval_config")
  deletedAt       DateTime? @map("deleted_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  agent     Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)
  knowledge Knowledge @relation(fields: [knowledgeId], references: [id], onDelete: Cascade)

  @@index([agentId], name: "idx_knowledge_binding_agent")
  @@index([knowledgeId], name: "idx_knowledge_binding_knowledge")
  @@unique([agentId, knowledgeId, version], name: "uq_agent_knowledge_version")
  @@map("agent_knowledge_bindings")
}
```

迁移：`pnpm prisma migrate dev`（或团队的 `db push` 流程）。老行 `kind` 取默认值 `experience`。**无需回填脚本**。

> 说明：`kind` 取值用应用层枚举约束（Zod / 类型联合），不在 DB 层加 check（MySQL 8 的 Prisma check 支持有限，且与现有 `status`/`source` 等字段一致采用应用层约束）。

## 5. 运行时行为（workstation）

### 5.1 挂钩点
`workstation/src/execution/agent-runner.ts` 的 `executeRun`（fresh 与 continue 两条路径的共享入口）。在 `arm().getAgent(run.agentId)` 拿到 `agentDetail`（含 `knowledgeBindings` 元数据）、`workspace.cwd` 解析完成之后、`new Agent(...)` 之前插入分流逻辑。

### 5.2 关键事实（已核实）
- 运行时绑定里**只有名字/id，没有 content**（`ArmAgentDetail.knowledgeBindings` 类型无 `content`）。写文件需逐条 `arm().getKnowledgeById(knowledgeId)`。
- Agent 工作目录是持久的 `data/workspaces/<workspaceId>`，但**只在 `enableTools=true` 时由 `buildTools` 创建**。因此 essential 下载需自行 `mkdirSync(<cwd>/knowledges, {recursive:true})`。
- 后端 `agents/[id]/download/route.ts` 已有现成的"知识→`.md` 文件"逻辑（`mkdtemp` + 循环绑定 + `fetchKnowledgeById` + `sanitizeFilename` 写文件），可直接镜像。

### 5.3 分流逻辑
```
按 kind 切分 agentDetail.knowledgeBindings:
  essential[] / experience[]

if enableTools:
  mkdir <cwd>/knowledges
  for b in essential:
    content = essentialCache.get(b.knowledgeId, b.version) ?? await arm.getKnowledgeById(b.knowledgeId)
    essentialCache.set(...)
    write <cwd>/knowledges/<sanitizeFilename(b.knowledgeName)>.md  with content
else (enableTools=false，纯对话 Agent 无文件工具):
  essential 内容直接拼进 system prompt（小集，可接受）

构建 system prompt（context-builder 分区提示，见 5.4）
```

### 5.4 `context-builder.ts` Layer 3 改造
从"无差别名单"改为分区：
```
## 已加载资源
### 必备业务知识（已下载到 knowledges/，开工前请查阅）
- <name1>
- <name2>
（enableTools=false 时：直接内联内容而非文件指引）

### 工作经验（按需检索，不占用上下文）
可使用 `arm_cli knowledge search "<关键词>"` 或 `knowledge info <name>` 检索以下工作经验：
- <name1>
- <name2>   （数量过多时只给数量 + 检索指引，避免名单本身过长）
```

### 5.5 essential 内容缓存
新增轻量进程内缓存（如 `essential-knowledge-cache.ts`），key = `${knowledgeId}:${version}`，value = content。同进程内重复 run 不重拉。`essential` 天然是小集，缓存内存占用可忽略。缓存无需持久化（重启后下次 run 重新拉取即可）。

### 5.6 experience 按需检索
workstation 的 `arm_cli` 工具新增 `knowledge search "<query>"` 子命令，打后端 `GET /api/v1/knowledges?search=<query>`（现有关键字检索）。对应在 `workstation/src/arm-client/client.ts` 新增 `searchKnowledges(query, opts?)`。v1 关键字检索即可，语义检索留后续。

## 6. 后端 / 类型 / CLI / Web 改动清单

### 6.1 共享类型
- `pkg/types/`、`backend/src/lib/types.ts`、`workstation/src/types.ts`：绑定类型新增 `kind: "essential" | "experience"`。

### 6.2 后端 API
- `POST /api/v1/agents/:id/knowledges`（绑定）：body 接受 `kind`，校验枚举，默认 `experience`；写入新绑定版本。
- `GET /api/v1/agents/:id`（Agent 详情）：每个绑定回传 `kind`（workstation 据此分流）。当前只回 `knowledge: {id,name,description}`，需补 `kind`。
- 响应仍用 `{ok, data, msg}` 封装；认证沿用 API key / SSO。

### 6.3 CLI（`cli/src/cmd/agent.ts` 绑定命令、`cli/src/cmd/knowledge.ts`）
- 绑定知识加 `--kind essential|experience` 参数（默认 `experience`）。
- `arm agent show` / 绑定列表显示每个绑定的 `kind`。
- CLI JSON 模式：`{ success, data }` / `{ success:false, error }`，遵循现有约定。

### 6.4 Web 控制台（`backend/src/app/(dashboard)/agents/page.tsx`）
- 绑定知识时可选择 `essential` / `experience`（radio / toggle）。
- 已绑定列表按 `kind` 分组展示（必备业务知识 / 工作经验）。
- 轻提醒：`essential` 数量过多（>N，如 5）会拖慢 Agent 启动（N 次 fetch）。
- UI 文案用中文"必备业务知识 / 工作经验"。

## 7. 知识飞轮机制（本设计的目标落点）

1. **上传**：用户上传知识（现有 `POST /knowledges`，markdown/zip）。
2. **分级绑定**：核心/必修的绑 `essential`（始终在场）；踩坑经验绑 `experience`（可搜可取、随便长）。
3. **使用**：`essential` 始终被读；`experience` 排障时被检索召回。
4. **反馈回流**：复用现有 `KnowledgeFeedback`（评分 / isHelpful / 评论）→ 低分（≤3）已会自动通知作者（现有逻辑）→ 作者改进内容 → 新版本 → 重新绑定 → Agent 下次 run 自动拿到新版（绑定是版本化的）。
5. **策展升降级（飞轮的筛选动作）**：高反馈的 `experience` → 晋升为 `essential`；过时的 `essential` → 降级为 `experience` 或更新版本。这种"经验↔必备"的升降级循环就是知识飞轮的策展引擎。

维度区分是飞轮能转的前提：`essential` 保 Agent 业务能力不下滑、又不撑爆上下文；`experience` 池可无限增长、不伤害任何 run。用户因此愿意持续上传经验、并策展一小撮必备知识，反馈随之流动。

## 8. 遵守的约定
- append-only 版本化绑定：`kind` 仅作为新列；改维度 = 新版本，不 update/硬删旧行。
- 软删：`deletedAt` 不变。
- API 响应：`{ok, data, msg}`（HTTP）/ `{success, data}`（CLI JSON）。
- 认证：`Authorization: Bearer <api-key>` 或 SSO Cookie。
- Skill 上传 multipart、Knowledge 内容存 DB 的现有方式不变。
- chunk 是派生数据可重建的约定在本设计不涉及（v1 不做 chunking）。

## 9. 边界与错误处理
- `essential` 绑定的知识 content 为空：跳过写文件，prompt 名单仍列名（标注无内容）。
- `getKnowledgeById` 失败（网络/权限）：该 essential 条目降级为"只列名 + 提示加载失败"，不阻塞 run 启动；记录日志。
- `enableTools=false`：essential 走 prompt 内联（不写文件）；experience 仍只列名（无工具时无法检索，提示用户该 Agent 未启用工具）。
- experience 名单过长：prompt 中只给数量 + 检索指引，不逐条列名，避免名单本身占用过多 token。
- 写文件文件名冲突 / 非法字符：复用 `sanitizeFilename`（仅保留字母数字与 CJK，其余转 `_`）。
- `kind` 非法值：API 层 Zod 校验拒绝，返回 400。

## 10. 测试策略
- **单测**：
  - `sanitizeFilename` 文件名清洗。
  - `context-builder` 分区提示输出（essential/experience 各自片段、enableTools 开关分支）。
  - essential 缓存命中/未命中。
- **集成（workstation）**：构造带 `essential` + `experience` 绑定的 mock agent → 跑 `executeRun`（mock-arm）→ 断言 `essential` 知识被写成 `<cwd>/knowledges/*.md`、`experience` 未写文件、system prompt 含分区提示。复用 `workstation/scripts/e2e-*` + `mock-arm` 模式。
- **后端**：`POST /agents/:id/knowledges` 带 `kind` → `GET /agents/:id` 回传含 `kind`；非法 `kind` 返回 400。
- **CLI**：`arm agent bind-knowledge ... --kind essential` → JSON 结构校验。
- **验证顺序**（遵循 `AGENTS.md`）：schema 改动 `pnpm prisma generate` → `db push` → `pnpm dev` 冒烟 → `pnpm lint`；workstation 改动 `bun run dev` + 必要时 `mock-arm` + e2e 脚本。

## 11. 待评审确认项
- [已定] 维度命名：`kind: "essential" | "experience"`（对应必备业务知识 / 工作经验）。
- [已定] 老绑定默认 `experience`（向后兼容）。
- [建议] `essential` "过多"阈值 N = 5（仅 Web 提醒，非硬限制）——可调。

## 12. 后续阶段（不在本 spec 范围）
1. RAG 语义检索：分块 + embedding（GLM embedding-3）+ 余弦召回 + `KnowledgeFeedback` 有用度重排；`retrievalConfig{topK,similarityThreshold}` 激活，服务于 `experience` 池。
2. 上传查重 / 相似问题 / metadata 过滤（产品/模块/错误码）。
3. 多方案 / 采纳最佳答案；Agent 排障成功后自动回填新知识（自动闭环飞轮）。
