# 知识飞轮 v1（绑定维度 essential/experience）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `AgentKnowledgeBinding` 增加 `kind` 维度（essential 必备业务知识 / experience 工作经验），essential 运行时下载到 Agent 工作区、experience 按需检索，跑通知识飞轮。

**Architecture:** 后端 Prisma 加一列 `kind`，绑定/详情 API 透传 `kind`；workstation 运行时（`executeRun`）按 `kind` 分流——essential 写成 `<cwd>/knowledges/*.md` 文件（带进程内 content 缓存），experience 不下载、由新增的 `knowledge_search` 工具检索全局知识库；system prompt 分区提示。CLI/Web 暴露 `kind` 选择。

**Tech Stack:** Next.js 14 + Prisma 5 + MySQL（backend）；Hono + bun:sqlite + pi-agent-core（workstation）；Bun CLI；React + shadcn/ui（Web）。

## Global Constraints

- `kind` 取值仅 `"essential" | "experience"`；默认 `"experience"`（老绑定向后兼容）。
- 绑定 append-only：`kind` 仅作新列，改维度=绑新版本，**绝不** update/硬删旧行。
- API 响应 `{ ok, data, msg }`；CLI JSON `{ success, data }` / `{ success:false, error:{code,message} }`。
- 认证：`Authorization: Bearer <api-key>` 或 SSO Cookie。
- backend 无测试运行器 → 验证用 `pnpm lint` + curl 冒烟；workstation/cli 是 bun 项目 → `bun test`（内置）/ `bun run`。
- 知识列表检索后端用 **`search`** query 参数（非 `keyword`）——见 `backend/src/app/api/v1/knowledges/route.ts:17`。
- UI 中文文案：必备业务知识 / 工作经验。

## 关键 v1 决策（实现时遵循）

1. **`knowledge_search` 检索全局知识库**（后端 `GET /knowledges?search=`），不限于本 Agent 绑定集——最大化飞轮价值；experience 绑定用于 prompt 提示（ curated 起始名单）+ 区分"不下载"。scoped 检索留后续。
2. **`knowledge_search` 工具随 `enableTools=true` 注册**（与现有 7 件套一致；纯对话 Agent 无工具，experience 仅以名单形式出现在 prompt）。
3. **DB migration 不在本会话对共享远程库执行**：仅 `pnpm prisma generate`（本地、无 DB 连接）+ lint/typecheck/bun test。`prisma db push`（触及共享 dev 库 `dev.aimstek.cn:31910`）由用户择机执行——见各 Task 验证步骤。

## File Structure

**Create:**
- `workstation/src/execution/knowledge-env.ts` — sanitizeFilename + `prepareEssentialKnowledges()`（下载/内联 essential + 进程内缓存）。
- `workstation/src/execution/knowledge-tools.ts` — `buildKnowledgeSearchTool()`（experience 检索工具）。
- `workstation/src/execution/knowledge-env.test.ts` — sanitizeFilename + prepareEssentialKnowledges 单测。
- `workstation/src/execution/context-builder.test.ts` — 分区提示单测。

**Modify:**
- `backend/prisma/schema.prisma` — `AgentKnowledgeBinding.kind`。
- `backend/src/app/api/v1/agents/[id]/knowledges/route.ts` — POST 接受/校验 kind；GET 回传 kind。
- `backend/src/app/api/v1/agents/[id]/route.ts` — 详情回传 kind。
- `backend/src/lib/types.ts` — 各绑定类型加 kind。
- `workstation/src/types.ts` — `knowledgeBindings[].kind`。
- `workstation/src/arm-client/client.ts` — `searchKnowledges()`；`bindKnowledgeToAgent` payload 加 kind。
- `workstation/src/execution/context-builder.ts` — Layer 3 分区（essential/experience）。
- `workstation/src/execution/agent-runner.ts` — `executeRun` 分流 + 调 prepare + 注册 knowledge_search。
- `cli/src/lib/client.ts` — `bindKnowledgeToAgent` 加 kind。
- `cli/src/cmd/agent.ts` — `bindKnowledge` 加 kind。
- `cli/src/main.ts` — 解析 `--kind=`。
- `backend/src/app/(dashboard)/agents/page.tsx` — 绑定 UI 加 kind 选择 + 分组展示。

---

## Task 1: Schema — `AgentKnowledgeBinding.kind`

**Files:**
- Modify: `backend/prisma/schema.prisma`（`AgentKnowledgeBinding` model，约 157-173 行）

**Interfaces:**
- Produces: `AgentKnowledgeBinding.kind: string`（DB 列 `kind`，默认 `'experience'`），供 Task 2 的 Prisma 查询写入/读取。

- [ ] **Step 1: 改 schema**

在 `AgentKnowledgeBinding` model 的 `version` 行后加 `kind` 字段：
```prisma
model AgentKnowledgeBinding {
  id              String    @id @default(uuid())
  agentId         String
  knowledgeId     String    @map("knowledge_id")
  version         String
  kind            String    @default("experience") @map("kind")
  retrievalConfig Json?     @map("retrieval_config")
  deletedAt       DateTime? @map("deleted_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  ...
}
```

- [ ] **Step 2: 生成 Prisma Client（本地，不连 DB）**

Run: `cd backend && pnpm prisma generate`
Expected: 成功输出 `✔ Generated Prisma Client`，无报错。

- [ ] **Step 3: 提交**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(schema): AgentKnowledgeBinding 增加 kind 维度（essential/experience）" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

> 注：`pnpm prisma db push`（写共享 dev 库）由用户执行。后续 Task 的 curl 冒烟在 push 后才能完整跑通。

---

## Task 2: Backend API — 绑定接受 kind、详情回传 kind

**Files:**
- Modify: `backend/src/app/api/v1/agents/[id]/knowledges/route.ts`（POST 接受+校验；GET 回传）
- Modify: `backend/src/app/api/v1/agents/[id]/route.ts`（GET 详情回传 kind，约 75-88 行）
- Modify: `backend/src/lib/types.ts`（`BindKnowledgeRequest`、`AgentKnowledge`、`AgentWithRelations.knowledges`、`AgentConfig.knowledges` 加 kind）
- Test: curl 冒烟（需 Task 1 的 db push 已执行）

**Interfaces:**
- Consumes: `AgentKnowledgeBinding.kind`（Task 1）。
- Produces: `POST /agents/:id/knowledges` body 接受 `kind`；`GET /agents/:id` 与 `GET /agents/:id/knowledges` 每条绑定回传 `kind`。供 workstation Task 3/6 消费。

- [ ] **Step 1: 绑定 POST 接受 + 校验 kind**

`agents/[id]/knowledges/route.ts` 顶部 interface 改为：
```ts
interface BindKnowledgeRequest {
  knowledgeId: string;
  version?: string;
  kind?: "essential" | "experience";
  retrievalConfig?: { topK?: number; similarityThreshold?: number };
}
```
在 `if (!body.knowledgeId)` 校验之后、`let version = body.version;` 之前加 kind 校验：
```ts
    const kind = body.kind ?? "experience";
    if (kind !== "essential" && kind !== "experience") {
      return errorResponse("kind 只能是 essential 或 experience", 400);
    }
```
`prisma.agentKnowledgeBinding.create` 的 `data` 加 `kind`：
```ts
      data: {
        agentId,
        knowledgeId: body.knowledgeId,
        version,
        kind,
        retrievalConfig: body.retrievalConfig as Prisma.InputJsonValue || {},
      },
```
成功响应加 `kind`：
```ts
    return successResponse({
      id: binding.id,
      agentId,
      knowledgeId: body.knowledgeId,
      version,
      kind,
      retrievalConfig: binding.retrievalConfig,
    }, '绑定成功');
```

- [ ] **Step 2: 绑定 GET 回传 kind**

同文件 `GET` handler 的 map 里，每条加 `kind: ak.kind`：
```ts
      agentKnowledges.map((ak) => ({
        id: ak.id,
        knowledgeId: ak.knowledgeId,
        version: ak.version,
        kind: ak.kind,
        knowledge: { id: ak.knowledge.id, name: ak.knowledge.name, description: ak.knowledge.description },
        retrievalConfig: ak.retrievalConfig as { topK?: number; similarityThreshold?: number } | undefined,
        createdAt: ak.createdAt.toISOString(),
      })),
```

- [ ] **Step 3: Agent 详情 GET 回传 kind**

`agents/[id]/route.ts` 的 `knowledges: knowledgeBindings.map(...)` 里加 `kind: ak.kind`：
```ts
      knowledges: knowledgeBindings.map((ak) => ({
        id: ak.id,
        knowledgeId: ak.knowledgeId,
        version: ak.version,
        kind: ak.kind,
        knowledge: { id: ak.knowledge.id, name: ak.knowledge.name, description: ak.knowledge.description },
        retrievalConfig: ak.retrievalConfig as { topK?: number; similarityThreshold?: number } | undefined,
      })),
```

- [ ] **Step 4: 共享类型加 kind**

`backend/src/lib/types.ts`：
- `BindKnowledgeRequest`（184-190）加 `kind?: "essential" | "experience";`
- `Agent.knowledges`（88-94）、`AgentKnowledge`（102-108）、`AgentWithRelations.knowledges`（116-122）、`AgentConfig.knowledges`（138-145）每项加 `kind?: "essential" | "experience";`

- [ ] **Step 5: 静态校验**

Run: `cd backend && pnpm lint`
Expected: 无 error（与改动前一致的 warning 水平）。

- [ ] **Step 6: curl 冒烟（需 db push 已执行；否则跳过并记录）**

启动 `cd backend && pnpm dev`（端口 3001），用有效 API key：
```bash
# 绑定为 essential
curl -s -X POST http://localhost:3001/api/v1/agents/<agentId>/knowledges \
  -H "Authorization: Bearer <KEY>" -H "Content-Type: application/json" \
  -d '{"knowledgeId":"<kid>","kind":"essential"}'
# 期望 data.kind == "essential"

# 非法 kind
curl -s -X POST http://localhost:3001/api/v1/agents/<agentId>/knowledges \
  -H "Authorization: Bearer <KEY>" -H "Content-Type: application/json" \
  -d '{"knowledgeId":"<kid>","kind":"bad"}'
# 期望 ok:false, 400

# 详情回传
curl -s http://localhost:3001/api/v1/agents/<agentId> -H "Authorization: Bearer <KEY>"
# 期望 knowledges[].kind 存在
```

- [ ] **Step 7: 提交**

```bash
git add backend/src/app/api/v1/agents/[id]/knowledges/route.ts backend/src/app/api/v1/agents/[id]/route.ts backend/src/lib/types.ts
git commit -m "feat(api): 绑定知识支持 kind（essential/experience），详情/列表回传" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Workstation — 类型 + ArmClient.searchKnowledges

**Files:**
- Modify: `workstation/src/types.ts`（`knowledgeBindings[].kind`）
- Modify: `workstation/src/arm-client/client.ts`（新增 `searchKnowledges`；`bindKnowledgeToAgent` payload 加 kind）
- Test: `bun run typecheck`

**Interfaces:**
- Produces: `ArmClient.searchKnowledges({keyword,page,pageSize})` → `{knowledges, total} | null`；`knowledgeBindings[].kind?: "essential"|"experience"`。供 Task 4/5/6 消费。

- [ ] **Step 1: 绑定类型加 kind**

`workstation/src/types.ts` 的 `ArmAgentDetail.knowledgeBindings`（36-42）加 `kind?`：
```ts
  knowledgeBindings?: Array<{
    id: string;
    knowledgeId: string;
    knowledgeName?: string;
    version: string;
    kind?: "essential" | "experience";
    retrievalConfig?: Record<string, unknown>;
  }>;
```

- [ ] **Step 2: 新增 searchKnowledges（用 search 参数）**

`workstation/src/arm-client/client.ts`，在 `listKnowledges` 方法后加：
```ts
  /**
   * 关键字检索知识库（对应 ARM GET /knowledges?search=）。
   * 注意：后端读的是 search 参数（非 keyword）。
   */
  async searchKnowledges(params: { keyword?: string; page?: number; pageSize?: number } = {}): Promise<{ knowledges: any[]; total: number } | null> {
    const sp = new URLSearchParams();
    if (params.keyword) sp.set("search", params.keyword);
    if (params.page) sp.set("page", String(params.page));
    if (params.pageSize) sp.set("pageSize", String(params.pageSize));
    const qs = sp.toString();
    const res = await this.request<{ knowledges: any[]; total: number }>(`/knowledges${qs ? `?${qs}` : ""}`);
    return res.ok ? res.data : null;
  }
```

- [ ] **Step 3: bindKnowledgeToAgent payload 加 kind**

同文件 `bindKnowledgeToAgent`（347-363）payload 类型加 `kind?: "essential" | "experience"`，body 加 `kind`：
```ts
  async bindKnowledgeToAgent(
    agentId: string,
    payload: {
      knowledgeId: string;
      version?: string;
      kind?: "essential" | "experience";
      retrievalConfig?: { topK?: number; similarityThreshold?: number };
    },
  ): Promise<{ id: string; knowledgeId: string; version: string } | null> {
    const res = await this.request<any>(
      `/agents/${encodeURIComponent(agentId)}/knowledges`,
      { method: "POST", body: JSON.stringify(payload) },
    );
    return res.ok && res.data ? res.data : null;
  },
```
> 注：直接 `JSON.stringify(payload)` 会带上 undefined 的 key 吗——不会，JSON.stringify 丢弃 undefined 字段，安全。

- [ ] **Step 4: typecheck**

Run: `cd workstation && bun run typecheck`
Expected: 无错误退出（`tsc --noEmit` 通过）。

- [ ] **Step 5: 提交**

```bash
git add workstation/src/types.ts workstation/src/arm-client/client.ts
git commit -m "feat(workstation): 绑定类型加 kind；ArmClient 新增 searchKnowledges" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Workstation — knowledge-env 模块（下载/内联 essential + 缓存）

**Files:**
- Create: `workstation/src/execution/knowledge-env.ts`
- Test: `workstation/src/execution/knowledge-env.test.ts`（`bun test`）

**Interfaces:**
- Consumes: `ArmClient.getKnowledgeById(id)`（已存在，返回 `{...,content?}|null`）；绑定 `{knowledgeId, knowledgeName?, version}`。
- Produces:
  - `sanitizeFilename(name: string): string`
  - `prepareEssentialKnowledges(bindings, cwd, enableTools, armClient): Promise<EssentialResult>`，其中
    `EssentialResult = { files: {name,filename}[]; inline: {name,content}[]; errors: string[] }`
- 缓存：模块级 `Map<"${knowledgeId}:${version}", string>`，content 命中则不重拉。

- [ ] **Step 1: 写失败测试 `knowledge-env.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "bun:test";
import { mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sanitizeFilename, prepareEssentialKnowledges, __resetEssentialCacheForTests } from "./knowledge-env.ts";

const fakeArm = (contents: Record<string, string>) => ({
  getKnowledgeById: async (id: string) => ({ id, name: id, content: contents[id] }),
});

describe("sanitizeFilename", () => {
  it("保留字母数字中文与 _-", () => {
    expect(sanitizeFilename("Nginx 504 / 超时.md")).toBe("Nginx_504____超时.md");
    expect(sanitizeFilename("a-b_c.1")).toBe("a-b_c_1");
  });
});

describe("prepareEssentialKnowledges", () => {
  const tmp = join(process.cwd(), "data", "test-tmp-ess");

  beforeEach(() => {
    __resetEssentialCacheForTests();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("enableTools 时写入 knowledges/*.md 文件", async () => {
    const r = await prepareEssentialKnowledges(
      [{ knowledgeId: "k1", knowledgeName: "必备A", version: "1.0.0" }],
      tmp, true, fakeArm({ k1: "# A\n正文" }) as any,
    );
    expect(r.files.length).toBe(1);
    expect(r.inline.length).toBe(0);
    expect(existsSync(join(tmp, "knowledges", sanitizeFilename("必备A") + ".md"))).toBe(true);
    expect(readFileSync(join(tmp, "knowledges", sanitizeFilename("必备A") + ".md"), "utf-8")).toContain("正文");
  });

  it("enableTools=false 时走 inline，不写文件", async () => {
    const r = await prepareEssentialKnowledges(
      [{ knowledgeId: "k1", knowledgeName: "必备A", version: "1.0.0" }],
      tmp, false, fakeArm({ k1: "正文A" }) as any,
    );
    expect(r.inline.length).toBe(1);
    expect(r.inline[0].content).toBe("正文A");
    expect(r.files.length).toBe(0);
    expect(existsSync(join(tmp, "knowledges"))).toBe(false);
  });

  it("content 命中缓存时不再次拉取", async () => {
    let calls = 0;
    const arm = { getKnowledgeById: async (id: string) => { calls++; return { id, content: "c" }; } };
    await prepareEssentialKnowledges([{ knowledgeId: "k1", version: "1.0.0" }], tmp, false, arm as any);
    await prepareEssentialKnowledges([{ knowledgeId: "k1", version: "1.0.0" }], tmp, false, arm as any);
    expect(calls).toBe(1);
  });

  it("getKnowledgeById 返回 null 时记入 errors 不抛错", async () => {
    const arm = { getKnowledgeById: async () => null };
    const r = await prepareEssentialKnowledges(
      [{ knowledgeId: "kx", knowledgeName: "缺失", version: "1.0.0" }], tmp, true, arm as any,
    );
    expect(r.errors).toEqual(["缺失"]);
    expect(r.files.length).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd workstation && bun test src/execution/knowledge-env.test.ts`
Expected: FAIL（模块不存在 / 导出缺失）。

- [ ] **Step 3: 实现 `knowledge-env.ts`**

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ArmClient } from "../arm-client/client.ts";

/** 与 backend agents/[id]/download/route.ts 的 sanitizeFilename 保持一致。 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9一-龥_-]/g, "_");
}

export interface EssentialEntry { name: string; filename: string; }
export interface EssentialInline { name: string; content: string; }
export interface EssentialResult {
  files: EssentialEntry[];      // enableTools=true：已写成文件的
  inline: EssentialInline[];    // enableTools=false：待内联进 prompt 的
  errors: string[];             // 加载失败的名称
}

interface EssentialBinding {
  knowledgeId: string;
  knowledgeName?: string;
  version: string;
}

// 进程内缓存：同 ${knowledgeId}:${version} 的 content 不重复拉取。
const contentCache = new Map<string, string>();
export function __resetEssentialCacheForTests(): void {
  contentCache.clear();
}

/**
 * 准备 essential 知识：
 * - enableTools=true：写到 <cwd>/knowledges/<sanitize>.md
 * - enableTools=false：返回 inline 内容由 prompt 内联
 * 失败（拉取返回 null）记入 errors，不中断。
 */
export async function prepareEssentialKnowledges(
  bindings: EssentialBinding[],
  cwd: string,
  enableTools: boolean,
  armClient: ArmClient,
): Promise<EssentialResult> {
  const files: EssentialEntry[] = [];
  const inline: EssentialInline[] = [];
  const errors: string[] = [];

  if (enableTools && bindings.length) {
    mkdirSync(join(cwd, "knowledges"), { recursive: true });
  }

  for (const b of bindings) {
    const name = b.knowledgeName ?? b.knowledgeId;
    const cacheKey = `${b.knowledgeId}:${b.version}`;
    let content = contentCache.get(cacheKey);
    if (content === undefined) {
      const k = await armClient.getKnowledgeById(b.knowledgeId);
      if (!k) { errors.push(name); continue; }
      content = k.content ?? "";
      contentCache.set(cacheKey, content);
    }
    const body = content || `# ${name}\n\n（内容为空）`;
    if (enableTools) {
      const filename = `${sanitizeFilename(name)}.md`;
      writeFileSync(join(cwd, "knowledges", filename), body, "utf-8");
      files.push({ name, filename });
    } else {
      inline.push({ name, content: body });
    }
  }
  return { files, inline, errors };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd workstation && bun test src/execution/knowledge-env.test.ts`
Expected: 4 个 it 全部 PASS。

- [ ] **Step 5: typecheck + 提交**

```bash
cd workstation && bun run typecheck
git add workstation/src/execution/knowledge-env.ts workstation/src/execution/knowledge-env.test.ts
git commit -m "feat(workstation): essential 知识下载到工作区（knowledge-env 模块 + 缓存 + 单测）" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Workstation — context-builder 分区 + knowledge_search 工具

**Files:**
- Modify: `workstation/src/execution/context-builder.ts`（Layer 3 分区）
- Create: `workstation/src/execution/knowledge-tools.ts`（`buildKnowledgeSearchTool`）
- Test: `workstation/src/execution/context-builder.test.ts`（`bun test`）

**Interfaces:**
- Consumes: `arm().searchKnowledges`（Task 3）；`buildSystemPrompt` options 新增 `essentialFiles`/`essentialInline`/`essentialErrors`。
- Produces: 分区后的 system prompt；`buildKnowledgeSearchTool(): AgentTool<any>`。供 Task 6 装配。

- [ ] **Step 1: 写失败测试 `context-builder.test.ts`**

```ts
import { describe, it, expect } from "bun:test";
import { buildSystemPrompt } from "./context-builder.ts";

const baseAgent = (kbs: any[]) => ({
  id: "a", name: "A", description: "d", prompt: "你是助手", version: "1", status: "active",
  createdAt: "", updatedAt: "", createdBy: "",
  knowledgeBindings: kbs,
}) as any;

describe("buildSystemPrompt 知识分区", () => {
  it("enableTools 时 essential 走文件提示、experience 走检索提示", () => {
    const p = buildSystemPrompt(baseAgent([
      { knowledgeId: "k1", knowledgeName: "必备A", version: "1", kind: "essential" },
      { knowledgeId: "k2", knowledgeName: "经验B", version: "1", kind: "experience" },
    ]), null, {
      enableTools: true, cwd: "/ws",
      essentialFiles: [{ name: "必备A", filename: "A.md" }],
    });
    expect(p).toContain("必备业务知识");
    expect(p).toContain("knowledges/A.md");
    expect(p).toContain("工作经验");
    expect(p).toContain("经验B");
    expect(p).toContain("knowledge_search");
  });

  it("enableTools=false 时 essential 内联、不出现 knowledges/ 路径", () => {
    const p = buildSystemPrompt(baseAgent([
      { knowledgeId: "k1", knowledgeName: "必备A", version: "1", kind: "essential" },
    ]), null, {
      enableTools: false, cwd: "/ws",
      essentialInline: [{ name: "必备A", content: "内联正文" }],
    });
    expect(p).toContain("必备业务知识");
    expect(p).toContain("内联正文");
    expect(p).not.toContain("knowledges/");
  });

  it("加载失败时提示 essentialErrors", () => {
    const p = buildSystemPrompt(baseAgent([
      { knowledgeId: "k1", knowledgeName: "必备A", version: "1", kind: "essential" },
    ]), null, { enableTools: true, cwd: "/ws", essentialErrors: ["必备A"] });
    expect(p).toContain("加载失败");
  });

  it("无 kind 的老绑定按 experience 处理", () => {
    const p = buildSystemPrompt(baseAgent([
      { knowledgeId: "k9", knowledgeName: "老知识", version: "1" },
    ]), null, { enableTools: true, cwd: "/ws" });
    expect(p).toContain("工作经验");
    expect(p).toContain("老知识");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd workstation && bun test src/execution/context-builder.test.ts`
Expected: FAIL（新 option 未生效）。

- [ ] **Step 3: 重写 `context-builder.ts` Layer 3**

把 `buildSystemPrompt` 的 options 与 Layer 3 段替换为下面这版（保留 Layer 1/2/Skills/工作能力 逻辑）：
```ts
import type { ArmAgentDetail } from "../types.ts";

interface BuildOptions {
  enableTools?: boolean;
  cwd?: string | null;
  essentialFiles?: Array<{ name: string; filename: string }>;
  essentialInline?: Array<{ name: string; content: string }>;
  essentialErrors?: string[];
}

/**
 * 三层 systemPrompt 组装：
 * Layer 1: ARM Agent.prompt（身份层）
 * Layer 2: Workspace.context（场景层，追加）
 * Layer 3: 已加载资源（Skills + 必备业务知识 / 工作经验）+ 工具行为指引
 */
export function buildSystemPrompt(
  agent: ArmAgentDetail,
  workspaceContext: string | null,
  options: BuildOptions = {},
): string {
  const { enableTools = false, cwd = null } = options;
  const parts: string[] = [];
  parts.push(agent.prompt || "你是一名 AI 助手。");

  if (workspaceContext && workspaceContext.trim()) {
    parts.push(`\n## 当前工作场景\n${workspaceContext.trim()}`);
  }

  // ── Layer 3：资源 ──
  const skillHints = (agent.skillBindings ?? []).map(
    (b) => `- ${b.skillName ?? b.skillId} (v${b.version})${b.config ? ` config=${JSON.stringify(b.config)}` : ""}`,
  );
  const experienceBindings = (agent.knowledgeBindings ?? []).filter(
    (b) => (b.kind ?? "experience") === "experience",
  );

  const hasEssential =
    !!options.essentialFiles?.length || !!options.essentialInline?.length;
  const hasExperience = experienceBindings.length > 0;

  if (skillHints.length || hasEssential || hasExperience) {
    parts.push(`\n## 已加载资源`);
    if (skillHints.length) parts.push(`\n### Skills\n${skillHints.join("\n")}`);

    if (options.essentialFiles?.length) {
      parts.push(`\n### 必备业务知识（已下载到 knowledges/，开工前请查阅）`);
      parts.push(options.essentialFiles.map((f) => `- ${f.name} → knowledges/${f.filename}`).join("\n"));
    } else if (options.essentialInline?.length) {
      parts.push(`\n### 必备业务知识`);
      for (const k of options.essentialInline) {
        parts.push(`\n#### ${k.name}\n${k.content}`);
      }
    }
    if (options.essentialErrors?.length) {
      parts.push(`\n> 部分必备知识加载失败：${options.essentialErrors.join(", ")}`);
    }

    if (hasExperience) {
      const names = experienceBindings.map((b) => b.knowledgeName ?? b.knowledgeId);
      parts.push(`\n### 工作经验（按需检索，不占用上下文）`);
      if (names.length <= 8) {
        parts.push(
          `可使用 knowledge_search 工具按关键词检索，或直接查阅：\n${names.map((n) => `- ${n}`).join("\n")}`,
        );
      } else {
        parts.push(`共 ${names.length} 条工作经验，请使用 knowledge_search 工具按关键词检索。`);
      }
    }
  }

  // ── 工具能力 ──
  if (enableTools) {
    parts.push(`\n## 工作能力`);
    parts.push(`\n你可以使用工具直接执行命令和读写文件。**请务必亲自调用工具完成任务，不要只把命令写出来让用户自己跑**。`);
    if (cwd) parts.push(`\n当前工作目录: \`${cwd}\` —— 所有 bash/read/write/edit 都在该目录下进行。`);
    parts.push(
      `\n可用工具：bash、read、write、edit、ls/grep/find、knowledge_search（按关键词检索全局「工作经验」知识库，排障时使用）。`,
    );
  }

  return parts.join("\n");
}
```

- [ ] **Step 4: 跑 context-builder 测试确认通过**

Run: `cd workstation && bun test src/execution/context-builder.test.ts`
Expected: 4 个 PASS。

- [ ] **Step 5: 创建 `knowledge-tools.ts`**

```ts
import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { arm } from "../arm-client/client.ts";

/**
 * 工作经验检索工具：按关键词检索全局知识库（ARM GET /knowledges?search=）。
 * 返回匹配条目的标题/描述/id，供 Agent 排障时定位历史经验。
 */
export function buildKnowledgeSearchTool(): AgentTool<any> {
  return {
    name: "knowledge_search",
    label: "检索工作经验知识库",
    description:
      "按关键词检索「工作经验」知识库，返回匹配条目（标题、描述、id）。遇到报错、排查问题、需要历史经验时调用。",
    parameters: Type.Object({
      query: Type.String({ description: "检索关键词，例如报错信息或问题主题" }),
    }),
    execute: async (args: { query: string }) => {
      const res = await arm().searchKnowledges({ keyword: args.query, pageSize: 10 });
      const items = (res?.knowledges ?? []) as Array<{ id: string; name: string; description?: string }>;
      const text =
        items.length === 0
          ? "未找到相关知识。"
          : items
              .map((k, i) => `${i + 1}. ${k.name}${k.description ? ` — ${k.description}` : ""} (id: ${k.id})`)
              .join("\n");
      return { content: [{ type: "text", text }], details: { count: items.length } };
    },
  } as AgentTool<any>;
}
```

- [ ] **Step 6: typecheck + 提交**

```bash
cd workstation && bun run typecheck
git add workstation/src/execution/context-builder.ts workstation/src/execution/knowledge-tools.ts workstation/src/execution/context-builder.test.ts
git commit -m "feat(workstation): system prompt 按必备/工作经验分区；新增 knowledge_search 工具" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Workstation — 在 executeRun 装配

**Files:**
- Modify: `workstation/src/execution/agent-runner.ts`（`executeRun`，约 325-348 行）

**Interfaces:**
- Consumes: `prepareEssentialKnowledges`（Task 4）、`buildKnowledgeSearchTool`（Task 5）、`buildSystemPrompt` 新 options（Task 5）、`arm()`、`workspaceCwdPath`。
- Produces: 运行时 essential 落盘 + experience 可检索的行为。

- [ ] **Step 1: 加 import**

文件顶部 import 区加：
```ts
import { prepareEssentialKnowledges } from "./knowledge-env.ts";
import { buildKnowledgeSearchTool } from "./knowledge-tools.ts";
```

- [ ] **Step 2: 在 executeRun 分流并准备 essential（插在 `enableTools` 解析之后、`systemPrompt` 构建之前）**

定位 `const enableTools = workspace?.enableTools ?? false;` 之后，插入：
```ts
  // 按 kind 分流知识：essential 下载/内联；experience 仅提示 + 检索工具
  const cwd = workspace?.cwd ?? workspaceCwdPath(run.workspaceId);
  const essentialBindings = (agentDetail.knowledgeBindings ?? [])
    .filter((b) => (b.kind ?? "experience") === "essential")
    .map((b) => ({ knowledgeId: b.knowledgeId, knowledgeName: b.knowledgeName, version: b.version }));
  const hasExperience = (agentDetail.knowledgeBindings ?? []).some(
    (b) => (b.kind ?? "experience") === "experience",
  );

  let essentialFiles: Awaited<ReturnType<typeof prepareEssentialKnowledges>>["files"] | undefined;
  let essentialInline: Awaited<ReturnType<typeof prepareEssentialKnowledges>>["inline"] | undefined;
  let essentialErrors: string[] | undefined;
  if (essentialBindings.length) {
    const r = await prepareEssentialKnowledges(essentialBindings, cwd, enableTools, arm());
    essentialFiles = r.files.length ? r.files : undefined;
    essentialInline = r.inline.length ? r.inline : undefined;
    essentialErrors = r.errors.length ? r.errors : undefined;
  }
```

- [ ] **Step 3: 把 essential 上下文传入 buildSystemPrompt**

把原 `const systemPrompt = run.systemPrompt || buildSystemPrompt(agentDetail, null, { enableTools, cwd: ... });` 改为（注意复用上面已定义的 `cwd`）：
```ts
  const systemPrompt =
    run.systemPrompt ||
    buildSystemPrompt(agentDetail, null, {
      enableTools,
      cwd,
      essentialFiles,
      essentialInline,
      essentialErrors,
    });
```

- [ ] **Step 4: 注册 knowledge_search 工具**

在 `if (enableTools) { ... }` 工具块内（`skillHint` push 之后、块结束之前）加：
```ts
    if (hasExperience || true) {
      tools.push(buildKnowledgeSearchTool());
    }
```
> 简化为始终注册（enableTools 即可检索全局经验库，最大化飞轮）。若希望仅在有 experience 绑定时注册，把条件改为 `if (hasExperience)`。本计划采用**始终注册**，故直接写 `tools.push(buildKnowledgeSearchTool());`（去掉 if）。

最终该段为：
```ts
  if (enableTools) {
    const cwd2 = workspace?.cwd ?? workspaceCwdPath(run.workspaceId);
    tools.push(...buildTools(cwd2));
    const skillSummaries = (agentDetail.skillBindings ?? []).map((b) => ({
      name: b.skillName ?? b.skillId, version: b.version, description: undefined,
    }));
    const skillHint = buildSkillHintTool(skillSummaries);
    if (skillHint) tools.push(skillHint);
    tools.push(buildKnowledgeSearchTool());
  }
```
（`buildTools` 那行原本用的变量名是 `cwd`，现已被上方 essential 逻辑占用，故改名 `cwd2` 避免重复声明。）

- [ ] **Step 5: typecheck**

Run: `cd workstation && bun run typecheck`
Expected: 通过。

- [ ] **Step 6: 冒烟（mock-arm，验证 essential 落盘）**

```bash
cd workstation
bun run mock-arm &           # 后台起 mock ARM
# 另起终端：用一个含 essential 绑定的 agent 跑一次 run，然后检查：
ls data/workspaces/<workspaceId>/knowledges/
# 期望：出现 essential 知识的 .md 文件
```
> mock-arm 需配置一个带 essential 绑定 + content 的 agent；若 mock 数据不含 essential，至少验证：`bun run dev` 正常启动、`knowledge_search` 工具注册不报错、typecheck 通过。

- [ ] **Step 7: 提交**

```bash
git add workstation/src/execution/agent-runner.ts
git commit -m "feat(workstation): executeRun 按 kind 分流——essential 下载到工作区、注册 knowledge_search" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: CLI — `arm agent bind --kind`

**Files:**
- Modify: `cli/src/lib/client.ts`（`bindKnowledgeToAgent` 加 kind）
- Modify: `cli/src/cmd/agent.ts`（`bindKnowledge` 加 kind）
- Modify: `cli/src/main.ts`（解析 `--kind=`，约 332-348 行）
- Test: `bun run src/main.ts ... --json` 冒烟

**Interfaces:**
- Consumes: backend `POST /agents/:id/knowledges` 接受 kind（Task 2）。
- Produces: `arm agent bind <id> --knowledge=<kid> --kind=essential`。

- [ ] **Step 1: client.ts bindKnowledgeToAgent 加 kind**

```ts
  async bindKnowledgeToAgent(agentId: string, knowledgeId: string, version: string, retrievalConfig?: { topK?: number; similarityThreshold?: number }, kind?: "essential" | "experience"): Promise<void> {
    const res = await this.request<null>(`/agents/${agentId}/knowledges`, {
      method: "POST",
      body: JSON.stringify({ knowledgeId, version, retrievalConfig, kind }),
    });
    if (!res.ok) throw new Error(res.msg);
  }
```

- [ ] **Step 2: agent.ts bindKnowledge 加 kind 参数并透传**

把 `bindKnowledge` 签名与内部调用改为：
```ts
export async function bindKnowledge(id: string, knowledgeId: string, version: string = '1.0.0', retrievalConfig?: string, kind?: 'essential' | 'experience'): Promise<void> {
  // ...（登录校验不变）...
  const client = new ApiClient(configStore.serverUrl, configStore.token);
  try {
    const parsedConfig = retrievalConfig ? JSON.parse(retrievalConfig) : undefined;
    await client.bindKnowledgeToAgent(id, knowledgeId, version, parsedConfig, kind);

    if (shouldOutputJson()) {
      outputJson({ success: true, data: { agentId: id, knowledgeId, version, kind: kind ?? 'experience', retrievalConfig: parsedConfig } });
      return;
    }
    success(`Knowledge "${knowledgeId}@${version}"（${kind ?? 'experience'}）已绑定到 Agent "${id}"`);
  } catch (err) { /* 不变 */ }
}
```

- [ ] **Step 3: main.ts 解析 --kind**

`case 'bind':` 的参数解析循环（约 332-343）加一个分支，并在调用处传入：
```ts
            let knowledgeKind: string | undefined;
            for (let i = 3; i < args.length; i++) {
              const arg = args[i];
              if (arg.startsWith('--skill=')) {
                skillId = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--knowledge=')) {
                knowledgeId = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--skill-config=')) {
                skillConfig = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--knowledge-config=')) {
                knowledgeConfig = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--kind=')) {
                knowledgeKind = arg.split('=').slice(1).join('=');
              }
            }

            if (skillId) {
              await bindSkill(id, skillId, undefined, skillConfig);
            } else if (knowledgeId) {
              const kind = (knowledgeKind === 'essential' || knowledgeKind === 'experience') ? knowledgeKind : undefined;
              await bindKnowledge(id, knowledgeId, undefined, knowledgeConfig, kind);
            } else {
              console.error('用法: arm agent bind <id> --skill=<skillId> 或 --knowledge=<knowledgeId> [--kind=essential|experience]');
              process.exit(1);
            }
```
（同时更新上方用法提示文案，加 `[--kind=essential|experience]`。）

- [ ] **Step 4: 冒烟（需 backend db push + dev 已起）**

```bash
cd cli && bun run src/main.ts agent bind <id> --knowledge=<kid> --kind=essential --json
# 期望 { success:true, data:{ kind:"essential" } }
cd cli && bun run src/main.ts agent bind <id> --knowledge=<kid> --kind=bad --json
# 后端拒绝 400 → CLI 输出 { success:false, error }
```

- [ ] **Step 5: 提交**

```bash
git add cli/src/lib/client.ts cli/src/cmd/agent.ts cli/src/main.ts
git commit -m "feat(cli): arm agent bind 支持 --kind=essential|experience" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Web — 绑定 UI 加 kind 选择 + 分组展示

**Files:**
- Modify: `backend/src/app/(dashboard)/agents/page.tsx`

**Interfaces:**
- Consumes: backend 绑定 API 接受/回传 kind（Task 2）。
- Produces: 用户在 Web 上为每条绑定知识选择 essential/experience，并按组展示。

- [ ] **Step 1: 类型加 kind**

`AgentKnowledge`（23-30）、`BoundKnowledge`（72-77）接口加 `kind?: "essential" | "experience";`。

- [ ] **Step 2: toggle 时默认 experience**

`handleToggleKnowledge`（443-453）新增项加 `kind: "experience"`：
```ts
      setBoundKnowledges([
        ...boundKnowledges,
        { knowledgeId: knowledge.id, name: knowledge.name, description: knowledge.description, kind: "experience", retrievalConfig: { topK: 5 } },
      ]);
```

- [ ] **Step 3: 绑定 POST 带 kind**

`bindSkillsAndKnowledges`（383-389）body 加 `kind: knowledge.kind`：
```ts
    for (const knowledge of boundKnowledges) {
      await fetch(`/api/v1/agents/${agentId}/knowledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeId: knowledge.knowledgeId, kind: knowledge.kind ?? "experience", retrievalConfig: knowledge.retrievalConfig }),
      });
    }
```

- [ ] **Step 4: 回填详情时携带 kind**

`enrichedKnowledges`（241-250）加 `kind: (ak as any).kind ?? "experience"`：
```ts
      const enrichedKnowledges = (detail.knowledges || []).map((ak: AgentKnowledge) => {
        const knowledgeInfo = knowledges.find(k => k.id === ak.knowledgeId);
        return {
          knowledgeId: ak.knowledgeId,
          name: knowledgeInfo?.name || ak.knowledgeId,
          description: knowledgeInfo?.description,
          kind: (ak as any).kind ?? "experience",
          retrievalConfig: ak.retrievalConfig || { topK: 5 },
        };
      });
```

- [ ] **Step 5: UI——已绑定列表按 kind 分组 + 每条加切换**

在渲染 `boundKnowledges` 的列表处，按 `kind` 分两段渲染（必备业务知识 / 工作经验），每条旁边放一个切换控件（沿用现有 shadcn Button/Toggle 风格）调用：
```ts
  const handleToggleKnowledgeKind = (knowledgeId: string) => {
    setBoundKnowledges(boundKnowledges.map(k =>
      k.knowledgeId === knowledgeId
        ? { ...k, kind: k.kind === "essential" ? "experience" : "essential" }
        : k
    ));
  };
```
分组渲染（在已绑定知识展示区，替换原单一列表）：
```tsx
{(["essential", "experience"] as const).map(group => {
  const items = boundKnowledges.filter(k => (k.kind ?? "experience") === group);
  if (!items.length) return null;
  return (
    <div key={group} className="space-y-2">
      <div className="text-sm font-medium">
        {group === "essential" ? "必备业务知识（下载到环境）" : "工作经验（按需检索）"}
      </div>
      {items.map(k => (
        <div key={k.knowledgeId} className="flex items-center justify-between rounded border px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{k.name}</div>
            {k.description && <div className="truncate text-xs text-muted-foreground">{k.description}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="text-xs underline" onClick={() => handleToggleKnowledgeKind(k.knowledgeId)}>
              {group === "essential" ? "改为工作经验" : "改为必备"}
            </button>
            <button type="button" className="text-xs text-destructive" onClick={() => handleRemoveKnowledge(k.knowledgeId)}>移除</button>
          </div>
        </div>
      ))}
    </div>
  );
})}
```
> essential 过多提醒：当 `boundKnowledges.filter(k=>k.kind==="essential").length > 5` 时，在该分组标题下显示一行 `text-xs text-amber-600`：「必备知识过多（>5）会拖慢 Agent 启动」。

- [ ] **Step 6: lint + 冒烟**

```bash
cd backend && pnpm lint
# pnpm dev 后：编辑某 agent，绑一条知识并切到「必备」，保存；
# Network 查 POST /agents/:id/knowledges body 含 kind:"essential"；详情回填后该条落在「必备业务知识」组。
```

- [ ] **Step 7: 提交**

```bash
git add "backend/src/app/(dashboard)/agents/page.tsx"
git commit -m "feat(web): 绑定知识可选择 essential/experience 并分组展示" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review（写完后自查，已修正）

- **Spec 覆盖**：schema(kind)→T1；绑定/详情 API→T2；essential 下载/缓存→T4；experience 检索工具→T3+T5；executeRun 分流→T6；CLI→T7；Web→T8；飞轮（反馈已有，本计划不改动 KnowledgeFeedback，符合 v1）✓。
- **占位符**：无 TBD；每步含真实代码或精确命令 ✓。
- **类型一致性**：`kind` 取值统一 `"essential"|"experience"`；`prepareEssentialKnowledges`/`buildSystemPrompt` 签名在产生/消费 Task 间一致；`searchKnowledges` 用 `search` 参数 ✓。
- **与 spec 一处偏离（已记录）**：spec §5.6 说"扩展 arm_cli"，实际 workstation 无 arm_cli 工具——改为新增一等 `knowledge_search` 工具（更干净），并在计划"关键 v1 决策"中说明检索范围为全局库。
