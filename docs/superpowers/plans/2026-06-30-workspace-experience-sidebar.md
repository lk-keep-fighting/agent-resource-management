# 工作经验侧栏（浏览 / 搜索 / 引用）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工作空间右侧侧栏展示当前 Agent 关联的工作经验（最新 N 条 + 搜索 + 阅读抽屉），并支持把选中经验以"本轮附加上下文"方式引用进对话。

**Architecture:** 前端为 vanilla JS SPA（`workstation/public/main.js` + `styles.css`），在 `renderWorkspaceChat` 的 `.chat-side` 内新增经验区/抽屉/引用标签。后端为 Hono on Bun（`workstation/src/`）：扩展 `runs` 路由接收 `pinnedExperienceIds`，经 `executeRun` → `resolvePinnedExperience`（新增，复用 `getKnowledgeById`）→ `buildSystemPrompt` 注入"用户本次引用的工作经验"分区。引用是派生数据，不落库、不产生新绑定。

**Tech Stack:** TypeScript + Hono + Bun（workstation 后端，`bun:test` 单测）；vanilla JS + `marked`/`DOMPurify`（前端 SPA）；ARM 客户端 `getKnowledgeById` / `getAgent`。

## Global Constraints

（摘自 spec `docs/superpowers/specs/2026-06-30-workspace-experience-sidebar-design.md`，每个任务的隐含要求）

- 知识 `kind: "essential" | "experience"`，默认 `"experience"`；经验=绿色，必备=琥珀（对齐控制台 `green-50/green-200`、`amber-50/amber-200`）。
- 引用标签**按消息清空**；单次引用**软上限 5 条**。
- 默认展示最新 **8 条**，按知识 `updatedAt` 倒序；超出提示"共 N 条 · 搜索全部"。
- **引用经验始终 inline 注入**（不受 `enableTools` 影响；不走写文件分支）。
- 当 `pinnedExperienceIds` 非空时，`executeRun` **必须绕过 `run.systemPrompt` 快照、重建 prompt**（否则快照先命中、引用内容被静默丢弃——见 Task 3）。
- 引用是派生数据：不落库、不改绑定、不 update/硬删旧行。
- API 响应 `{ok, data, msg}`；认证沿用 API key / SSO。
- 单测：`bun test src/execution/<file>.test.ts`（在 `workstation/` 目录下）；类型检查：`bun run typecheck`。前端 SPA 无 JS 单测框架，按既有惯例用**人工冒烟**验证。

---

## File Structure

- **Modify** `workstation/src/execution/context-builder.ts` — `BuildOptions` 增加 `pinnedExperience`/`pinnedErrors`；新增"用户本次引用的工作经验"分区。
- **Modify** `workstation/src/execution/knowledge-env.ts` — 新增 `resolvePinnedExperience(ids, armClient)`，按 id 取全文、去重、缺失进 errors。
- **Modify** `workstation/src/execution/agent-runner.ts` — `RunOptions` 增加 `pinnedExperienceIds`；`executeRun` 解析并在有引用时绕过快照重建 prompt。
- **Modify** `workstation/src/routes/runs.ts` — 两个 handler 的 body 接收 `pinnedExperienceIds` 并透传 `executeRun`。
- **Modify** `workstation/public/main.js` — `renderWorkspaceChat` 内新增经验区/必备折叠/阅读抽屉/搜索/引用标签；`send()` body 携带 `pinnedExperienceIds` 并发送后清空。
- **Modify** `workstation/public/styles.css` — 新增 `.exp-*` / `.cite-*` / `.exp-drawer*` 样式。
- **Test** `workstation/src/execution/context-builder.test.ts`、`workstation/src/execution/knowledge-env.test.ts`（既有文件，追加用例）。

---

### Task 1: context-builder 注入"引用的工作经验"分区

**Files:**
- Modify: `workstation/src/execution/context-builder.ts`（`BuildOptions` 约 2-9 行；"已加载资源"分区约 48-76 行；在函数末尾 `return parts.join(...)` 之前插入）
- Test: `workstation/src/execution/context-builder.test.ts`

**Interfaces:**
- Consumes: 无（叶子单元）。
- Produces: `BuildOptions.pinnedExperience?: Array<{ name: string; content: string }>`、`BuildOptions.pinnedErrors?: string[]`；`buildSystemPrompt` 在 `pinnedExperience` 非空时输出 `### 用户本次引用的工作经验` 分区。Task 3 依赖这两个字段名。

- [ ] **Step 1: 写失败测试**

在 `workstation/src/execution/context-builder.test.ts` 末尾追加（复用文件顶部已有的 `baseAgent` 工厂）：

```ts
describe("buildSystemPrompt 引用经验", () => {
  it("pinnedExperience 注入「用户本次引用的工作经验」分区与内容", () => {
    const p = buildSystemPrompt(baseAgent([]), null, {
      pinnedExperience: [{ name: "OOM 排查三步", content: "第一步：看 GC 日志" }],
    });
    expect(p).toContain("用户本次引用的工作经验");
    expect(p).toContain("OOM 排查三步");
    expect(p).toContain("第一步：看 GC 日志");
  });

  it("无 pinnedExperience 时不出现引用分区", () => {
    const p = buildSystemPrompt(baseAgent([]), null, {});
    expect(p).not.toContain("用户本次引用的工作经验");
  });

  it("pinnedErrors 输出加载失败提示", () => {
    const p = buildSystemPrompt(baseAgent([]), null, {
      pinnedExperience: [{ name: "A", content: "a" }],
      pinnedErrors: ["kMissing"],
    });
    expect(p).toContain("部分引用经验加载失败");
    expect(p).toContain("kMissing");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run（在 `workstation/` 目录）: `bun test src/execution/context-builder.test.ts`
Expected: FAIL（`pinnedExperience` 类型不存在 / 不含"用户本次引用的工作经验"）。

- [ ] **Step 3: 实现**

3a. 在 `context-builder.ts` 的 `BuildOptions` 接口追加两个字段：

```ts
interface BuildOptions {
  enableTools?: boolean;
  cwd?: string | null;
  essentialFiles?: Array<{ name: string; filename: string }>;
  essentialInline?: Array<{ name: string; content: string }>;
  essentialErrors?: string[];
  pinnedExperience?: Array<{ name: string; content: string }>;
  pinnedErrors?: string[];
}
```

3b. 在 `buildSystemPrompt` 函数体内、"已加载资源"分区构造之后、函数末尾 `return parts.join(...)` 之前，插入（独立 `if`，不嵌套在既有 `skillHints/hasEssential/hasExperience` 守卫内，确保即使无其它资源也能出现）：

```ts
  if (options.pinnedExperience?.length) {
    parts.push(`\n### 用户本次引用的工作经验`);
    for (const k of options.pinnedExperience) {
      parts.push(`\n#### ${k.name}\n${k.content}`);
    }
  }
  if (options.pinnedErrors?.length) {
    parts.push(`\n> 部分引用经验加载失败：${options.pinnedErrors.join(", ")}`);
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test src/execution/context-builder.test.ts`
Expected: PASS（含新追加的 3 个用例）。

- [ ] **Step 5: 提交**

```bash
git add workstation/src/execution/context-builder.ts workstation/src/execution/context-builder.test.ts
git commit -m "feat(workstation): context-builder 注入「用户本次引用的工作经验」分区"
```

---

### Task 2: knowledge-env 新增 resolvePinnedExperience

**Files:**
- Modify: `workstation/src/execution/knowledge-env.ts`（文件末尾导出区追加）
- Test: `workstation/src/execution/knowledge-env.test.ts`

**Interfaces:**
- Consumes: `ArmClient.getKnowledgeById(id)`（既有）。
- Produces: `resolvePinnedExperience(ids: string[], armClient: ArmClient): Promise<{ items: Array<{ name: string; content: string }>; errors: string[] }>`。Task 3 调用它。

**设计说明（YAGNI）:** 引用是每轮、≤5 条、即用即弃，**不复用 essential 的 `contentCache`**（避免缓存里只有 content 没有 name 的取值问题），直接逐条 `getKnowledgeById`。

- [ ] **Step 1: 写失败测试**

在 `workstation/src/execution/knowledge-env.test.ts` 末尾追加（复用该文件既有的 `fakeArm` 模式）：

```ts
import { resolvePinnedExperience } from "./knowledge-env.ts";

describe("resolvePinnedExperience", () => {
  const fakeArm = (db: Record<string, any>) => ({
    getKnowledgeById: async (id: string) => db[id] ?? null,
  });

  it("取全文并保留 name，去重，缺失进 errors", async () => {
    const r = await resolvePinnedExperience(
      ["k1", "k1", "k2", "kMissing"],
      fakeArm({
        k1: { id: "k1", name: "经验一", content: "c1" },
        k2: { id: "k2", name: "经验二", content: "c2" },
      }) as any,
    );
    expect(r.items).toEqual([
      { name: "经验一", content: "c1" },
      { name: "经验二", content: "c2" },
    ]);
    expect(r.errors).toEqual(["kMissing"]);
  });

  it("content 缺失时当作空串，name 缺失回退为 id", async () => {
    const r = await resolvePinnedExperience(
      ["k1"],
      fakeArm({ k1: { id: "k1" } }) as any,
    );
    expect(r.items).toEqual([{ name: "k1", content: "" }]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bun test src/execution/knowledge-env.test.ts`
Expected: FAIL（`resolvePinnedExperience` 未导出）。

- [ ] **Step 3: 实现**

在 `workstation/src/execution/knowledge-env.ts` 文件末尾追加：

```ts
export interface PinnedItem {
  name: string;
  content: string;
}
export interface PinnedResult {
  items: PinnedItem[];
  errors: string[];
}

/**
 * 解析用户本轮引用的经验：按 id 取全文，去重；取不到的进 errors。
 * 引用即用即弃（≤5 条/轮），不复用 essential 缓存。
 */
export async function resolvePinnedExperience(
  ids: string[],
  armClient: ArmClient,
): Promise<PinnedResult> {
  const items: PinnedItem[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const k = await armClient.getKnowledgeById(id);
    if (!k) {
      errors.push(id);
      continue;
    }
    items.push({ name: k.name ?? id, content: k.content ?? "" });
  }
  return { items, errors };
}
```

> 若 lint 报 `ArmClient` 未导入，确认文件顶部已 `import type { ArmClient } from "../arm-client/client.ts"`（与 `prepareEssentialKnowledges` 同一来源；如已存在则无需重复）。

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test src/execution/knowledge-env.test.ts`
Expected: PASS。

- [ ] **Step 5: 类型检查**

Run: `bun run typecheck`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add workstation/src/execution/knowledge-env.ts workstation/src/execution/knowledge-env.test.ts
git commit -m "feat(workstation): 新增 resolvePinnedExperience 解析引用经验全文"
```

---

### Task 3: 后端打通——executeRun 透传引用 + 路由接收

**Files:**
- Modify: `workstation/src/execution/agent-runner.ts`（`RunOptions` 约 57-70 行；essential 预备约 332-354 行；顶部 import 区）
- Modify: `workstation/src/routes/runs.ts`（两个 handler：`POST /workspaces/:workspaceId/runs` 约 23-79 行；`POST /runs/:id/messages` 约 84-112 行）

**Interfaces:**
- Consumes: Task 1 的 `BuildOptions.pinnedExperience/pinnedErrors`；Task 2 的 `resolvePinnedExperience`。
- Produces: `executeRun` 接受 `RunOptions.pinnedExperienceIds?: string[]`；两个 SSE 路由 body 接受 `pinnedExperienceIds?: string[]`。Task 8（前端 send）依赖路由支持该字段。

**关键防坑:** `runs.ts` 在 `executeRun` 之前会快照 `run.systemPrompt`，而 `executeRun` 当前以 `run.systemPrompt || buildSystemPrompt(...)` 为准（约 347 行）。若引用内容只在 fallback 分支注入，**快照会先命中、引用被静默丢弃**。因此当 `pinnedExperienceIds` 非空时**必须绕过快照、强制重建**。

- [ ] **Step 1: 改 agent-runner —— RunOptions + import**

1a. 顶部 import 区追加（与既有 `prepareEssentialKnowledges` 同处）：

```ts
import { resolvePinnedExperience } from "./knowledge-env.ts";
```

1b. `RunOptions` 接口追加一个字段：

```ts
interface RunOptions {
  run: WsRun;
  userMessage: string;
  sender: SseSender;
  abortSignal?: AbortSignal;
  historyMode: "continue" | "fresh";
  pinnedExperienceIds?: string[];
}
```

- [ ] **Step 2: 改 agent-runner —— 解析引用并在有引用时绕过快照**

在 `executeRun` 内、essential 预备块（约 336-344 行的 `if (essentialBindings.length) {...}`）之后、`buildSystemPrompt` 调用（约 346 行）之前，插入：

```ts
  let pinnedExperience: Array<{ name: string; content: string }> | undefined;
  let pinnedErrors: string[] | undefined;
  if (opts.pinnedExperienceIds?.length) {
    const r = await resolvePinnedExperience(opts.pinnedExperienceIds, arm());
    pinnedExperience = r.items.length ? r.items : undefined;
    pinnedErrors = r.errors.length ? r.errors : undefined;
  }
```

然后把约 346-354 行的 systemPrompt 构造改为（有引用时强制重建，绕过 `run.systemPrompt` 快照）：

```ts
  const promptOpts = { enableTools, cwd, essentialFiles, essentialInline, essentialErrors };
  const systemPrompt = opts.pinnedExperienceIds?.length
    ? buildSystemPrompt(agentDetail, null, { ...promptOpts, pinnedExperience, pinnedErrors })
    : (run.systemPrompt || buildSystemPrompt(agentDetail, null, promptOpts));
```

> 保留 `essentialFiles/essentialInline/essentialErrors` 既有变量名与语义不变；只是抽成 `promptOpts` 复用。

- [ ] **Step 3: 改 runs 路由 —— 两个 handler 接收并透传**

对 `workstation/src/routes/runs.ts` 中**两个** handler（create 与 continue）各做同样两处改动：

3a. body 解析扩字段（替换各自的 `const body = ... as { message?: string }`）：

```ts
  const body = (await c.req.json().catch(() => ({}))) as {
    message?: string;
    pinnedExperienceIds?: string[];
  };
```

3b. 在 `executeRun({...})` 调用对象里追加一行（防御：仅当是字符串数组时透传）：

```ts
  const result = await executeRun({
    run,
    userMessage: body.message!.trim(),
    sender: send,
    historyMode: "fresh", // 另一个 handler 为 "continue"
    pinnedExperienceIds:
      Array.isArray(body.pinnedExperienceIds) ? body.pinnedExperienceIds : undefined,
  });
```

- [ ] **Step 4: 类型检查**

Run: `bun run typecheck`
Expected: 无错误。

- [ ] **Step 5: 回归既有单测**

Run: `bun test src/execution/context-builder.test.ts src/execution/knowledge-env.test.ts`
Expected: PASS（不应被本次改动破坏）。

- [ ] **Step 6: 人工冒烟（后端注入验证）**

1. 起 workstation：`bun run dev`（与后端/ARM 互通；如用 mock：`bun run mock-arm`）。
2. 选一个绑定了 ≥1 条 experience 知识的 Agent 的工作空间。
3. 用 curl 直接打 create 路由，带 `pinnedExperienceIds`：

```bash
curl -N -X POST http://localhost:<port>/api/ws/workspaces/<wsId>/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" -H "X-User-Id: <uid>" \
  -d '{"message":"复述我引用的经验标题","pinnedExperienceIds":["<knowledgeId>"]}'
```

4. 预期：SSE 流正常返回；在 Runs 详情（UI 的 Runs tab 或 `GET /api/ws/runs/<runId>`）可见 system prompt 含 `### 用户本次引用的工作经验` + 该经验 name/content。
5. 不带 `pinnedExperienceIds` 重发 → system prompt **不含**该分区（回归无副作用）。

> 若 `GET /runs/:id` 不回传 systemPrompt，则改为观察 assistant 回复是否基于引用内容作答（如能准确说出经验标题）。

- [ ] **Step 7: 提交**

```bash
git add workstation/src/execution/agent-runner.ts workstation/src/routes/runs.ts
git commit -m "feat(workstation): executeRun/路由透传 pinnedExperienceIds 并绕过快照注入引用经验"
```

---

### Task 4: 前端样式——经验区 / 抽屉 / 引用标签

**Files:**
- Modify: `workstation/public/styles.css`（在 `.chat-*` 区块附近，约 256 行之后追加）

**Interfaces:**
- Consumes: 既有 `.chat-side / .muted / .tag / .divider`。
- Produces: `.exp-section / .exp-item / .essential-collapse / .exp-drawer / .exp-drawer-backdrop / .cite-bar / .cite-chip` 等类，供 Task 5-8 使用。

- [ ] **Step 1: 追加样式**

在 `workstation/public/styles.css` 的 `.chat-side` 规则之后追加：

```css
/* ─────────── 工作经验侧栏 ─────────── */
.exp-section { display: flex; flex-direction: column; min-height: 0; }
.exp-head { display: flex; align-items: center; gap: 6px; margin: 4px 0 6px; }
.exp-head .title { font-weight: 600; }
.exp-count { color: #86909c; font-size: 11.5px; }
.exp-search-btn { margin-left: auto; cursor: pointer; background: none; border: none; font-size: 13px; color: #4e5969; }
.exp-search-input { width: 100%; box-sizing: border-box; padding: 4px 8px; font-size: 12px; border: 1px solid #e5e6eb; border-radius: 6px; margin-bottom: 6px; }
.exp-list { overflow-y: auto; max-height: calc(100vh - 360px); display: flex; flex-direction: column; gap: 4px; }
.exp-item { border: 1px solid #e5e6eb; border-left: 3px solid #00b42a; border-radius: 6px; padding: 6px 8px; cursor: pointer; background: #fff; }
.exp-item:hover { background: #f7f8fa; }
.exp-item .name { font-weight: 600; font-size: 12.5px; }
.exp-item .desc { color: #86909c; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.exp-item .meta { color: #a99; font-size: 11px; display: flex; align-items: center; gap: 6px; }
.exp-item .pin { margin-left: auto; cursor: pointer; border: none; background: none; font-size: 13px; color: #00b42a; }
.exp-empty { color: #86909c; padding: 10px 0; text-align: center; }
.exp-hint { color: #86909c; font-size: 11px; padding: 4px 0; }
.essential-collapse { font-size: 11.5px; color: #4e5969; cursor: pointer; margin-bottom: 4px; }
.essential-collapse .list { margin-top: 4px; padding-left: 4px; }
.essential-collapse .row { color: #d97706; padding: 2px 0; }

/* ─────────── 阅读抽屉 ─────────── */
.exp-drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.25); z-index: 50; }
.exp-drawer {
  position: fixed; top: 56px; right: 0; bottom: 0;
  width: min(640px, 60vw); background: #fff; box-shadow: -2px 0 12px rgba(0,0,0,0.12);
  z-index: 51; display: flex; flex-direction: column; border-left: 1px solid #e5e6eb;
}
.exp-drawer .head { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #f2f3f5; }
.exp-drawer .head .name { font-weight: 600; flex: 1; }
.exp-drawer .head .close { cursor: pointer; border: none; background: none; font-size: 16px; color: #86909c; }
.exp-drawer .body { flex: 1; overflow-y: auto; padding: 12px 16px; }
.exp-drawer .foot { padding: 10px 16px; border-top: 1px solid #f2f3f5; display: flex; gap: 8px; align-items: center; }
.badge-exp { background: #e8ffea; color: #00b42a; border: 1px solid #b9e6c6; border-radius: 4px; padding: 1px 6px; font-size: 11px; }
.badge-ess { background: #fff7e8; color: #d97706; border: 1px solid #ffd6a8; border-radius: 4px; padding: 1px 6px; font-size: 11px; }

/* ─────────── 引用标签栏 ─────────── */
.cite-bar { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 0; min-height: 0; }
.cite-bar .hint { width: 100%; color: #86909c; font-size: 11px; }
.cite-chip { display: inline-flex; align-items: center; gap: 4px; background: #e8ffea; border: 1px solid #b9e6c6; color: #00b42a; border-radius: 12px; padding: 2px 8px; font-size: 11.5px; }
.cite-chip .x { cursor: pointer; }
```

- [ ] **Step 2: 人工目检**

起 `bun run dev`，打开任一工作空间；样式此时尚无元素使用，仅确认 CSS 无解析报错（控制台无 404/语法错）。元素在 Task 5 起逐步出现。

- [ ] **Step 3: 提交**

```bash
git add workstation/public/styles.css
git commit -m "style(workstation): 经验侧栏/阅读抽屉/引用标签样式"
```

---

### Task 5: 前端数据层 + 经验列表 + 必备折叠

**Files:**
- Modify: `workstation/public/main.js`（`renderWorkspaceChat` 内，`.chat-side` 构造区约 1457-1471 行；新增 helper 函数）

**Interfaces:**
- Consumes: `api(path, opts)`（约 60 行）、`el()`（约 5 行）、`renderMarkdown()`（约 105 行）；`GET /agents/:id` → `data.knowledgeBindings[]`（每项 `{knowledgeId, knowledgeName, version, kind?}`，已被 `renderAgentDetail` 于 797 行使用，确认存在）；`GET /knowledges/:id` → `{id, name, description, content, updatedAt}`。
- Produces: 模块闭包状态 `experienceItems`（已排序的最新经验数组）、`essentialItems`；渲染经验区 DOM。

**数据策略（v1）:** 拉取本 Agent 的全部 experience 绑定，逐条 `GET /knowledges/:id` 取 `{name, description, content, updatedAt}`（并行），按 `updatedAt` 倒序，展示前 8 条，内容随列表预取（抽屉即时打开，无需再请求）。**已知 v1 限制：** 经验池极大时全量拉取偏重；后续可换后端 `sort+limit` 接口。搜索（Task 7）与引用（Task 8）复用此预取集合。

- [ ] **Step 1: 实现——侧栏结构 + 数据拉取 + 列表渲染**

在 `renderWorkspaceChat` 内、`layout.appendChild(side);`（约 1471 行）**之前**插入对 `side` 的经验区挂载；并在 `renderWorkspaceChat` 函数体内（与 `currentRunId` 等闭包变量同处，约 1476 行附近）新增闭包状态与函数。

1a. 在 `// ───── 行为 ─────` 区（约 1475 行之后）新增闭包状态：

```js
  // ── 工作经验侧栏状态 ──
  let experienceItems = [];     // [{id,name,description,content,updatedAt}]
  let essentialItems = [];      // [{id,name}]
  let citedExperienceIds = [];  // 引用中的经验 id（≤5）
```

1b. 在 `side.appendChild(... "📌 上下文" ...)`（约 1469-1470 行）之后、`layout.appendChild(side)` 之前，插入经验区容器：

```js
  side.appendChild(el("div", { class: "divider" }));
  const expSection = el("div", { class: "exp-section" });
  expSection.appendChild(el("div", { class: "exp-empty" }, "加载经验中…"));
  side.appendChild(expSection);
```

1c. 在 `renderWorkspaceChat` 函数体内（建议放在 `send` 函数定义之前）新增数据加载与渲染函数：

```js
  function fmtRelative(iso) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    if (d <= 0) return "今天更新";
    if (d === 1) return "昨天更新";
    if (d < 30) return `${d} 天前更新`;
    return `${Math.floor(d / 30)} 个月前更新`;
  }

  async function loadExperience() {
    const agent = await api(`/agents/${encodeURIComponent(ws.agentId)}`).catch(() => null);
    if (!agent) { renderExpList(); return; }
    const bindings = agent.knowledgeBindings ?? [];
    const expBindings = bindings.filter((b) => (b.kind ?? "experience") === "experience");
    const essBindings = bindings.filter((b) => b.kind === "essential");
    // 并行取全文（含 description/updatedAt/content）
    const expDetails = await Promise.all(
      expBindings.map((b) => api(`/knowledges/${encodeURIComponent(b.knowledgeId)}`).catch(() => null)),
    );
    experienceItems = expDetails
      .filter(Boolean)
      .map((k) => ({ id: k.id, name: k.name, description: k.description, content: k.content, updatedAt: k.updatedAt }))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    essentialItems = essBindings.map((b) => ({ id: b.knowledgeId, name: b.knowledgeName ?? b.knowledgeId }));
    renderExpList();
  }

  function renderExpList(filter) {
    expSection.innerHTML = "";
    // 必备折叠区
    if (essentialItems.length) {
      const col = el("div", { class: "essential-collapse" }, [
        el("span", { onclick: () => { col.dataset.open = col.dataset.open === "1" ? "0" : "1"; renderExpList(filter); } },
          (essentialItems.length ? `📦 已加载必备 ${essentialItems.length} 篇 ` : "") + (expSection.dataset.essOpen === "1" ? "▾" : "▸")),
      ]);
      if (expSection.dataset.essOpen === "1") {
        const list = el("div", { class: "list" }, essentialItems.map((k) =>
          el("div", { class: "row", onclick: () => openExpDrawer(k, "essential") }, `• ${k.name}`)));
        col.appendChild(list);
      }
      expSection.appendChild(col);
    }
    // 标题行 + 搜索按钮
    const head = el("div", { class: "exp-head" }, [
      el("span", { class: "title" }, "📚 工作经验"),
      el("span", { class: "exp-count" }, `${experienceItems.length}`),
      el("button", { class: "exp-search-btn", title: "搜索", onclick: () => toggleSearch() }, "🔍"),
    ]);
    expSection.appendChild(head);

    // 搜索框（仅展开时）
    if (expSection.dataset.search === "1") {
      const input = el("input", { class: "exp-search-input", placeholder: "搜索经验标题/描述…", value: filter ?? "" });
      input.addEventListener("input", () => renderExpList(input.value));
      expSection.appendChild(input);
    }

    // 列表（过滤）
    const q = (filter ?? "").trim().toLowerCase();
    const items = q
      ? experienceItems.filter((k) => (k.name + " " + (k.description ?? "")).toLowerCase().includes(q))
      : experienceItems.slice(0, 8);

    if (!experienceItems.length) {
      expSection.appendChild(el("div", { class: "exp-empty" }, [
        el("div", {}, "这位员工暂无工作经验沉淀"),
        el("button", { class: "ctx-menu-item", style: { marginTop: "6px" }, onclick: () => handleSummarize() }, "把这次对话总结成经验"),
      ]));
      return;
    }
    const list = el("div", { class: "exp-list" }, items.map((k) =>
      el("div", { class: "exp-item", onclick: () => openExpDrawer(k, "experience") }, [
        el("div", { class: "name" }, k.name),
        el("div", { class: "desc" }, k.description ?? "(无描述)"),
        el("div", { class: "meta" }, [
          el("span", {}, fmtRelative(k.updatedAt)),
          el("button", { class: "pin", title: "引用进对话", onclick: (e) => { e.stopPropagation(); citeExperience(k); } }, "📌"),
        ]),
      ])));
    expSection.appendChild(list);
    if (!q && experienceItems.length > 8) {
      expSection.appendChild(el("div", { class: "exp-hint" }, `共 ${experienceItems.length} 条 · 🔍 搜索全部`));
    }
    if (q && !items.length) {
      expSection.appendChild(el("div", { class: "exp-hint" }, "没找到匹配的经验，换个词？"));
    }
  }

  function toggleSearch() {
    expSection.dataset.search = expSection.dataset.search === "1" ? "0" : "1";
    renderExpList(expSection.dataset.search === "1" ? "" : undefined);
  }

  loadExperience(); // 进入工作空间即加载
```

> `openExpDrawer` / `citeExperience` 在 Task 6 / Task 8 实现；此处先调用，定义后即生效（JS 函数提升对 `function` 声明有效，`renderWorkspaceChat` 内的嵌套 `function` 同样提升）。为避免运行期 ReferenceError，确保 Task 6/8 在本 Task 之后连续完成；或在实现本 Task 时先放占位 `function openExpDrawer(){} function citeExperience(){}`，后续 Task 替换——本步骤采用后者更稳：先在 `loadExperience()` 之前加两个空函数占位：

```js
  function openExpDrawer(_k, _kind) { /* Task 6 实现 */ }
  function citeExperience(_k) { /* Task 8 实现 */ }
```

- [ ] **Step 2: 人工冒烟**

1. `bun run dev`；打开一个绑定了经验（与必备）知识的 Agent 工作空间。
2. 预期：右侧出现 `📦 已加载必备 N 篇 ▸`（可展开列名）+ `📚 工作经验 N` + 最新 ≤8 条卡片（绿左条、标题/描述/相对时间/📌）。
3. 无经验的工作空间 → 显示空态 +「把这次对话总结成经验」按钮。
4. 点 📌 / 卡片（Task 6/8 前为空操作，不报错）。

- [ ] **Step 3: 提交**

```bash
git add workstation/public/main.js
git commit -m "feat(web): 工作空间侧栏渲染工作经验列表与必备折叠区"
```

---

### Task 6: 前端阅读抽屉

**Files:**
- Modify: `workstation/public/main.js`（替换 Task 5 留下的 `openExpDrawer` 占位）

**Interfaces:**
- Consumes: Task 5 的 `experienceItems`（已预取 content）/ `essentialItems`；`renderMarkdown()`；Task 4 的 `.exp-drawer*` 样式；Task 8 的 `citeExperience`（点引用按钮时调用）。
- Produces: `openExpDrawer(knowledge, "experience"|"essential")`。

- [ ] **Step 1: 实现抽屉**

用以下实现**替换** Task 5 中的占位 `function openExpDrawer(_k, _kind) {}`：

```js
  function closeExpDrawer() {
    const b = document.getElementById("exp-drawer-backdrop");
    const d = document.getElementById("exp-drawer");
    if (b) b.remove();
    if (d) d.remove();
    document.removeEventListener("keydown", onDrawerEsc);
  }
  function onDrawerEsc(e) { if (e.key === "Escape") closeExpDrawer(); }

  function openExpDrawer(k, kind) {
    closeExpDrawer(); // 防重复
    const backdrop = el("div", { id: "exp-drawer-backdrop", class: "exp-drawer-backdrop", onclick: closeExpDrawer });
    const drawer = el("div", { id: "exp-drawer", class: "exp-drawer" }, [
      el("div", { class: "head" }, [
        el("span", { class: kind === "essential" ? "badge-ess" : "badge-exp" }, kind === "essential" ? "必备" : "经验"),
        el("span", { class: "name" }, k.name),
        el("button", { class: "close", onclick: closeExpDrawer }, "✕"),
      ]),
      el("div", { class: "body", html: renderMarkdown(k.content ?? "(无内容)") }),
      el("div", { class: "foot" }, [
        el("button", { onclick: () => {
          navigator.clipboard?.writeText(k.content ?? "");
        } }, "复制全文"),
        kind === "essential"
          ? el("span", { class: "badge-ess" }, "✓ 已在工作区")
          : el("button", { class: "primary", onclick: () => citeExperience(k) }, "📌 引用进对话"),
      ]),
    ]);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    document.addEventListener("keydown", onDrawerEsc);
  }
```

- [ ] **Step 2: 人工冒烟**

1. 打开工作空间，点一条经验卡片 → 右侧滑出抽屉（遮罩 + `min(640px,60vw)`），正文为渲染后的 markdown。
2. `Esc` / 点遮罩 / 点 ✕ 均可关闭。
3. 必备条目抽屉底部显示「✓ 已在工作区」而非引用按钮；经验条目显示「📌 引用进对话」（Task 8 前点击为空操作，不报错）。
4. 「复制全文」写入剪贴板。

- [ ] **Step 3: 提交**

```bash
git add workstation/public/main.js
git commit -m "feat(web): 经验阅读抽屉（markdown 全文/复制/引用）"
```

---

### Task 7: 前端搜索

**Files:**
- Modify: `workstation/public/main.js`（`toggleSearch` 已在 Task 5 实现；本任务为验证 + 微调）

**说明:** 客户端过滤已在 Task 5 的 `renderExpList(filter)` 内实现（按 name+description 命中）。本任务仅做边界验证与微调。

- [ ] **Step 1: 人工冒烟**

1. 打开工作空间，点标题行 🔍 → 出现搜索框。
2. 输入关键词 → 列表即时过滤为命中项；清空 → 回到最新 8 条。
3. 无命中 → 显示「没找到匹配的经验，换个词？」。
4. 再点 🔍 或清空 → 收起搜索框。

- [ ] **Step 2: （可选）微调**

若希望 `Esc` 清空搜索：在 Task 5 的搜索 `input` 监听后追加 `addEventListener("keydown", e => { if (e.key==="Escape") { input.value=""; renderExpList(""); } })`。无微调则跳过本步。

- [ ] **Step 3: 提交（若有改动）**

```bash
git add workstation/public/main.js
git commit -m "feat(web): 经验侧栏客户端搜索"
```

---

### Task 8: 前端引用标签 + 接入 send()

**Files:**
- Modify: `workstation/public/main.js`（替换 Task 5 的 `citeExperience` 占位；新增 `renderCiteBar` 与 `unciteExperience`；改造 `send()` 的 fetch body 约 1728-1732 行；新增 cite-bar 节点挂到 `inputArea` 之前）

**Interfaces:**
- Consumes: Task 3 的后端路由（`pinnedExperienceIds`）；Task 4 的 `.cite-bar/.cite-chip` 样式；闭包 `citedExperienceIds`（Task 5 声明）。
- Produces: 引用标签栏 UI；`send()` 发送 `pinnedExperienceIds` 并发送后清空。

- [ ] **Step 1: 挂载 cite-bar 节点**

在 `renderWorkspaceChat` 内、`main.appendChild(inputArea);`（约 1440 行）**之前**插入：

```js
  const citeBar = el("div", { class: "cite-bar" });
  main.appendChild(citeBar);
```

并在 Task 5 声明的闭包状态区追加引用名缓存：

```js
  const citedMeta = {}; // id -> {name}，用于标签文案
```

- [ ] **Step 2: 实现引用增删与渲染**

用以下实现**替换** Task 5 的占位 `function citeExperience(_k) {}`，并新增 `unciteExperience` / `renderCiteBar`：

```js
  function citeExperience(k) {
    if (citedExperienceIds.length >= 5 && !citedExperienceIds.includes(k.id)) {
      alert("单次最多引用 5 条经验");
      return;
    }
    if (citedExperienceIds.includes(k.id)) { closeExpDrawer(); return; }
    citedExperienceIds.push(k.id);
    citedMeta[k.id] = { name: k.name };
    renderCiteBar();
    closeExpDrawer();
  }
  function unciteExperience(id) {
    citedExperienceIds = citedExperienceIds.filter((x) => x !== id);
    renderCiteBar();
  }
  function renderCiteBar() {
    citeBar.innerHTML = "";
    if (!citedExperienceIds.length) return;
    citedExperienceIds.forEach((id) =>
      citeBar.appendChild(el("span", { class: "cite-chip" }, [
        `📌 ${citedMeta[id]?.name ?? id} `,
        el("span", { class: "x", onclick: () => unciteExperience(id) }, "✕"),
      ])));
    citeBar.appendChild(el("div", { class: "hint" }, `本次对话将附带 ${citedExperienceIds.length} 条经验`));
  }
```

- [ ] **Step 3: 改造 send() —— 携带引用并按消息清空**

定位 `send()` 内的 fetch（约 1728-1732 行）。把 body 改为携带 `pinnedExperienceIds`，并在 `await fetch` **之前**清空引用（ids 已序列化进 body）：

```js
      const payload = {
        message: text,
        pinnedExperienceIds: citedExperienceIds.length ? [...citedExperienceIds] : undefined,
      };
      // 引用按消息清空：ids 已进 payload，立即复位 UI
      citedExperienceIds = [];
      renderCiteBar();
      const res = await fetch(`/api/ws/workspaces/${workspaceId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(payload),
      });
```

- [ ] **Step 4: 端到端人工冒烟（关键路径）**

1. `bun run dev`（后端已含 Task 3 改动）。
2. 打开绑定了经验的工作空间，点经验卡片 → 抽屉 →「📌 引用进对话」→ 输入框上方出现绿色标签 `📌 经验名 ✕` +「本次对话将附带 1 条经验」。
3. 点 ✕ 移除；再引用；尝试引用第 6 条 → 弹「单次最多引用 5 条经验」。
4. 发送一条消息（如「请基于我引用的经验，用一句话总结要点」）。
5. 预期：发送后标签立即清空；assistant 回复能准确反映被引用经验的内容（证明后端注入生效）。
6. 不引用直接发消息 → 行为与改动前一致（回归）。

- [ ] **Step 5: 提交**

```bash
git add workstation/public/main.js
git commit -m "feat(web): 经验引用标签（按消息清空）并接入 send 携带 pinnedExperienceIds"
```

---

## Self-Review

（写计划后自查，已内联修正）

**1. Spec 覆盖：**
- 浏览（默认最新 8 + 抽屉全文）→ Task 5 + 6 ✓
- 搜索（本 Agent 池、客户端过滤、无结果态）→ Task 5（renderExpList filter）+ Task 7 ✓
- 引用（标签附加、按消息清空、软上限 5、本轮注入）→ Task 8 + 后端 Task 1/2/3 ✓
- 阅读抽屉（覆盖对话区、Esc/遮罩关闭、必备只读"已在工作区"）→ Task 6 ✓
- 必备折叠区 → Task 5 ✓
- 空态 CTA 接 `handleSummarize` → Task 5 ✓
- 边界：加载失败/无内容/Agent 未启用工具（注入不受 enableTools 影响）→ Task 2(无内容空串) + Task 3(always inline) ✓；列表加载失败 `loadExperience` catch → 空列表 ✓
- 视觉语言（绿=经验/琥珀=必备、复用类）→ Task 4 ✓
- 数据衔接（复用 `GET /agents/:id`、`GET /knowledges/:id`；唯一实质改动为 pinned 注入；updatedAt 已由 `GET /knowledges/:id` 提供，无需后端改动）→ Task 3 + Task 5 ✓

**2. 占位扫描：** 无 TBD/TODO；`openExpDrawer`/`citeExperience` 在 Task 5 用空函数占位、Task 6/8 替换——已显式说明，非遗留占位。

**3. 类型/命名一致性：** `pinnedExperience` / `pinnedErrors`（Task 1 BuildOptions）↔ Task 3 透传字段名一致；`resolvePinnedExperience`（Task 2）↔ Task 3 调用名一致；`pinnedExperienceIds`（前端 Task 8 payload）↔ 路由 Task 3 body 字段 ↔ `RunOptions.pinnedExperienceIds` 一致；闭包 `citedExperienceIds` / `experienceItems` / `essentialItems` 跨 Task 5-8 命名一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-30-workspace-experience-sidebar.md`.
