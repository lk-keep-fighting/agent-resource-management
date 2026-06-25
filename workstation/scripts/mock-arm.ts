/**
 * Mock ARM Backend - 用于本地 e2e 测试 Agent Workstation
 *
 * 用法：
 *   bun run scripts/mock-arm.ts [port]      # 默认 3000
 *
 * 提供一个最小 ARM API 子集：agents / skills / knowledges / health
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const port = Number(process.argv[2] ?? "3000");

interface MockAgent {
  id: string;
  name: string;
  description: string;
  prompt: string;
  avatar: string;
  version: string;
  status: "active" | "draft";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  skillBindings: Array<{ id: string; skillId: string; skillName: string; version: string }>;
  knowledgeBindings: Array<{ id: string; knowledgeId: string; knowledgeName: string; version: string }>;
}

const now = new Date().toISOString();

const agents: MockAgent[] = [
  {
    id: "agent-bug-classifier",
    name: "Bug 分类专员",
    description: "帮我把堆栈 / 日志自动归类为 P0/P1/P2 三个等级",
    prompt:
      "你是一名 Bug 分类专员。当用户给出堆栈跟踪或日志时，你需要：\n1. 识别故障模块\n2. 归类严重等级 (P0/P1/P2)\n3. 给出初步根因与建议\n回答格式：\n## 故障模块: <name>\n## 现象: <description>\n## 初步根因: <root cause>\n## 建议: <next steps>",
    avatar: "🐛",
    version: "1.0.0",
    status: "active",
    createdAt: now,
    updatedAt: now,
    createdBy: "mock-user",
    skillBindings: [
      { id: "b1", skillId: "skill-log-parser", skillName: "log-parser", version: "1.2.0" },
    ],
    knowledgeBindings: [
      { id: "k1", knowledgeId: "knowledge-incidents", knowledgeName: "故障知识库", version: "2.1.0" },
    ],
  },
  {
    id: "agent-translator",
    name: "翻译专员",
    description: "中英 / 古文今译 / 技术文档翻译",
    prompt: "你是一名专业的翻译官，根据用户指示翻译文本。",
    avatar: "🌐",
    version: "1.0.0",
    status: "active",
    createdAt: now,
    updatedAt: now,
    createdBy: "mock-user",
    skillBindings: [],
    knowledgeBindings: [],
  },
  {
    id: "agent-writer",
    name: "文案专员",
    description: "帮你写公众号、产品介绍、邮件",
    prompt: "你是一名文案专员，擅长写有温度、有结构的文案。",
    avatar: "✍️",
    version: "1.0.0",
    status: "active",
    createdAt: now,
    updatedAt: now,
    createdBy: "mock-user",
    skillBindings: [],
    knowledgeBindings: [],
  },
];

const app = new Hono();

// ──────────── Auth (Mock) ────────────
// Mock 用户表 + API Key
const mockUsers: Record<string, { id: string; name: string; email: string; role: string }> = {
  "arm_alpha_2026": { id: "user-alice", name: "Alice", email: "alice@example.com", role: "USER" },
  "arm_beta_2026": { id: "user-bob", name: "Bob", email: "bob@example.com", role: "USER" },
};

app.post("/api/v1/auth/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { apiKey?: string };
  const apiKey = body.apiKey?.trim();
  if (!apiKey) return c.json({ ok: false, data: null, msg: "API Key 不能为空" }, 400);
  const user = mockUsers[apiKey];
  if (!user) return c.json({ ok: false, data: null, msg: "无效的 API Key" }, 401);
  return c.json({
    ok: true,
    data: {
      user: { ...user, createdAt: new Date().toISOString() },
      token: apiKey,
    },
    msg: "登录成功",
  });
});

app.get("/api/v1/auth/me", (c) => {
  const auth = c.req.header("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return c.json({ ok: false, data: null, msg: "未授权" }, 401);
  const user = mockUsers[m[1]];
  if (!user) return c.json({ ok: false, data: null, msg: "无效 token" }, 401);
  return c.json({ ok: true, data: { ...user, createdAt: new Date().toISOString() }, msg: "获取成功" });
});

app.get("/api/v1/health", (c) => c.json({ ok: true, data: { status: "ok" }, msg: "mock arm alive" }));

app.get("/api/v1/agents", (c) => {
  const createdBy = c.req.query("createdBy");
  const filtered = createdBy ? agents.filter((a) => a.createdBy === createdBy) : agents;
  return c.json({
    ok: true,
    data: {
      agents: filtered.map((a) => ({
        ...a,
        skillsCount: a.skillBindings.length,
        knowledgesCount: a.knowledgeBindings.length,
      })),
      total: agents.length,
      page: 1,
      pageSize: 20,
    },
    msg: "操作成功",
  });
});

// ──────────── 我的资产（必须在 :id 之前，否则被吞） ────────────
app.get("/api/v1/agents/mine", (c) => {
  const createdBy = c.req.query("createdBy");
  if (!createdBy) return c.json({ ok: false, data: null, msg: "createdBy 必填" }, 400);
  const mine = agents.filter((a) => a.createdBy === createdBy);
  return c.json({
    ok: true,
    data: {
      total: mine.length,
      agents: mine.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        avatar: a.avatar,
        version: a.version,
        status: a.status,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        feedbackSummary: {
          total: feedbacks.filter((f) => f.agentId === a.id).length,
          avgRating: null,
          lowScore: 0,
          helpfulCount: feedbacks.filter((f) => f.agentId === a.id && f.isHelpful === true).length,
          unhelpfulCount: feedbacks.filter((f) => f.agentId === a.id && f.isHelpful === false).length,
        },
        recentFeedbacks: feedbacks
          .filter((f) => f.agentId === a.id)
          .slice(0, 5)
          .map((f) => ({
            rating: f.rating,
            isHelpful: f.isHelpful,
            comment: f.comment,
            externalRunId: f.externalRunId,
            createdAt: f.createdAt,
          })),
      })),
    },
    msg: "操作成功",
  });
});

app.get("/api/v1/agents/:id", (c) => {
  const id = c.req.param("id");
  const a = agents.find((x) => x.id === id);
  if (!a) return c.json({ ok: false, data: null, msg: "Agent 不存在" }, 404);
  const agentFbs = feedbacks.filter((f) => f.agentId === id);
  const ratings = agentFbs.map((f) => f.rating).filter((r): r is number => typeof r === "number");
  const avg = ratings.length === 0 ? null : Math.round((ratings.reduce((x, y) => x + y, 0) / ratings.length) * 10) / 10;
  return c.json({
    ok: true,
    data: {
      ...a,
      skills: a.skillBindings.map((sb) => ({
        id: sb.id, skillId: sb.skillId, version: sb.version,
        skill: { id: sb.skillId, name: sb.skillName, description: "" },
      })),
      knowledges: a.knowledgeBindings.map((kb) => ({
        id: kb.id, knowledgeId: kb.knowledgeId, version: kb.version,
        knowledge: { id: kb.knowledgeId, name: kb.knowledgeName, description: "" },
      })),
      feedbackSummary: {
        total: agentFbs.length,
        avgRating: avg,
        helpfulCount: agentFbs.filter((f) => f.isHelpful === true).length,
        unhelpfulCount: agentFbs.filter((f) => f.isHelpful === false).length,
      },
    },
    msg: "操作成功",
  });
});

app.post("/api/v1/agents", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<MockAgent>;
  if (!body.name || !body.prompt) return c.json({ ok: false, data: null, msg: "name/prompt 必填" }, 400);
  const newAgent: MockAgent = {
    id: `agent-${Date.now()}`,
    name: body.name!,
    description: body.description ?? "",
    prompt: body.prompt!,
    avatar: body.avatar ?? "🤖",
    version: "1.0.0",
    status: "active",
    createdAt: now,
    updatedAt: now,
    createdBy: "mock-user",
    skillBindings: [],
    knowledgeBindings: [],
  };
  agents.push(newAgent);
  return c.json({ ok: true, data: newAgent, msg: "创建成功" }, 201);
});

// ──────────── Feedback ────────────
const feedbacks: Array<{
  id: string;
  agentId: string;
  agentVersion: string | null;
  rating: number | null;
  isHelpful: boolean | null;
  comment: string | null;
  tags: string[] | null;
  source: string | null;
  externalRunId: string | null;
  createdAt: string;
}> = [
  // seed：让 list 页 / detail 页反馈流有数据可看
  { id: "fb-seed-1", agentId: "agent-bug-classifier", agentVersion: "1.0.0", rating: 5, isHelpful: true,  comment: "非常准，省了大量人工分诊时间。P0/P1 标准建议沉淀成 Knowledge。", tags: ["效率"], source: "agent-workstation", externalRunId: null, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: "fb-seed-2", agentId: "agent-bug-classifier", agentVersion: "1.0.0", rating: 4, isHelpful: true,  comment: "整体方向对，但偶发把内存泄漏归到 P2，调阈值更稳。", tags: null, source: "agent-workstation", externalRunId: null, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString() },
  { id: "fb-seed-3", agentId: "agent-bug-classifier", agentVersion: "1.0.0", rating: 3, isHelpful: false, comment: "对冷门模块识别不准，需要补业务上下文。", tags: ["准确率"], source: "agent-workstation", externalRunId: null, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString() },
  { id: "fb-seed-4", agentId: "agent-bug-classifier", agentVersion: "1.0.0", rating: 5, isHelpful: true,  comment: "👍", tags: null, source: "agent-workstation", externalRunId: null, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString() },
  { id: "fb-seed-5", agentId: "agent-translator",    agentVersion: "1.0.0", rating: 4, isHelpful: true,  comment: "技术文档翻译质量不错，但语气偏直译。", tags: null, source: "agent-workstation", externalRunId: null, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
];

app.post("/api/v1/agents/:id/feedback", async (c) => {
  const id = c.req.param("id");
  const agent = agents.find((a) => a.id === id);
  if (!agent) return c.json({ ok: false, data: null, msg: "Agent 不存在" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as any;
  if (body.rating !== undefined && body.rating !== null && (body.rating < 1 || body.rating > 5)) {
    return c.json({ ok: false, data: null, msg: "rating 必须是 1-5" }, 400);
  }
  const fb = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agentId: id,
    agentVersion: body.agentVersion ?? agent.version,
    rating: body.rating ?? null,
    isHelpful: body.isHelpful ?? null,
    comment: body.comment ?? null,
    tags: body.tags ?? null,
    source: body.source ?? "agent-workstation",
    externalRunId: body.externalRunId ?? null,
    createdAt: new Date().toISOString(),
  };
  feedbacks.push(fb);
  console.log(`[mock-arm] feedback received: agent=${id} rating=${fb.rating} helpful=${fb.isHelpful}`);
  return c.json({ ok: true, data: fb, msg: "反馈已记录" }, 201);
});

app.get("/api/v1/agents/:id/feedback", (c) => {
  const id = c.req.param("id");
  const items = feedbacks.filter((f) => f.agentId === id);
  const ratings = items.map((i) => i.rating).filter((r): r is number => typeof r === "number");
  const avg = ratings.length === 0 ? null : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
  return c.json({
    ok: true,
    data: {
      total: items.length,
      avgRating: avg,
      helpfulCount: items.filter((i) => i.isHelpful === true).length,
      unhelpfulCount: items.filter((i) => i.isHelpful === false).length,
      items,
    },
    msg: "操作成功",
  });
});

app.get("/api/v1/skills", (c) => {
  return c.json({
    ok: true,
    data: {
      skills: [
        { id: "skill-log-parser", name: "log-parser", description: "日志解析", version: "1.2.0", status: "active", publishedBy: "mock-user" },
      ],
      total: 1,
    },
    msg: "操作成功",
  });
});

app.get("/api/v1/knowledges", (c) => {
  return c.json({
    ok: true,
    data: {
      knowledges: [
        { id: "knowledge-incidents", name: "故障知识库", description: "常见故障", version: "2.1.0", createdBy: "mock-user" },
      ],
      total: 1,
    },
    msg: "操作成功",
  });
});

app.post("/api/v1/knowledges", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; description?: string; content?: string };
  if (!body.name) return c.json({ ok: false, data: null, msg: "name 必填" }, 400);
  const created = {
    id: `knowledge-${Date.now()}`,
    name: body.name,
    description: body.description ?? "",
    content: body.content ?? "",
    createdBy: "mock-user",
    createdAt: now,
    updatedAt: now,
  };
  return c.json({ ok: true, data: created, msg: "创建成功" }, 201);
});

// ──────────── Skill/Knowledge 详情 + 反馈 ────────────
const skillFeedbacks: any[] = [];
const knowledgeFeedbacks: any[] = [];
const notifications: any[] = [];

app.get("/api/v1/skills/:name", (c) => {
  const name = c.req.param("name");
  if (name !== "log-parser") return c.json({ ok: false, data: null, msg: "Skill 不存在" }, 404);
  const items = skillFeedbacks.filter((f) => f.skillId === "skill-log-parser");
  const ratings = items.map((i) => i.rating).filter((r: any) => typeof r === "number");
  return c.json({
    ok: true,
    data: {
      id: "skill-log-parser",
      name: "log-parser",
      description: "日志解析",
      version: "1.2.0",
      status: "active",
      publishedBy: { id: "mock-user", name: "Mock User" },
      publishedAt: now,
      updatedAt: now,
      downloadCount: 0,
      feedbackSummary: {
        total: items.length,
        avgRating: ratings.length === 0 ? null : Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10,
        helpfulCount: items.filter((i) => i.isHelpful === true).length,
        unhelpfulCount: items.filter((i) => i.isHelpful === false).length,
      },
    },
    msg: "操作成功",
  });
});

app.post("/api/v1/skills/:id/feedback", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as any;
  if (body.rating !== undefined && body.rating !== null && (body.rating < 1 || body.rating > 5)) {
    return c.json({ ok: false, data: null, msg: "rating 必须是 1-5" }, 400);
  }
  const fb = {
    id: `sf-${Date.now()}`,
    skillId: id,
    rating: body.rating ?? null,
    isHelpful: body.isHelpful ?? null,
    comment: body.comment ?? null,
    tags: body.tags ?? null,
    source: body.source ?? "agent-workstation",
    externalRunId: body.externalRunId ?? null,
    createdAt: new Date().toISOString(),
  };
  skillFeedbacks.push(fb);
  console.log(`[mock-arm] skill feedback: skill=${id} rating=${fb.rating}`);
  // 低分推通知
  if (fb.rating !== null && fb.rating <= 3) {
    notifications.push({
      id: `n-${Date.now()}`,
      userId: "mock-user",
      type: "skill_feedback",
      refId: id,
      refName: "log-parser",
      title: `Skill "log-parser" 收到 ${fb.rating} 星评价`,
      body: fb.comment,
      meta: { rating: fb.rating, isHelpful: fb.isHelpful },
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }
  return c.json({ ok: true, data: fb, msg: "反馈已记录" }, 201);
});

app.get("/api/v1/skills/:id/feedback", (c) => {
  const id = c.req.param("id");
  const items = skillFeedbacks.filter((f) => f.skillId === id);
  const ratings = items.map((i) => i.rating).filter((r: any) => typeof r === "number");
  return c.json({
    ok: true,
    data: {
      total: items.length,
      avgRating: ratings.length === 0 ? null : Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10,
      helpfulCount: items.filter((i) => i.isHelpful === true).length,
      unhelpfulCount: items.filter((i) => i.isHelpful === false).length,
      items,
    },
    msg: "操作成功",
  });
});

app.get("/api/v1/knowledges/:id", (c) => {
  const id = c.req.param("id");
  if (id !== "knowledge-incidents") return c.json({ ok: false, data: null, msg: "Knowledge 不存在" }, 404);
  const items = knowledgeFeedbacks.filter((f) => f.knowledgeId === id);
  const ratings = items.map((i) => i.rating).filter((r: any) => typeof r === "number");
  return c.json({
    ok: true,
    data: {
      id,
      name: "故障知识库",
      description: "常见故障",
      content: "## 常见故障清单\n\n1. CPU 100%\n2. 内存泄漏\n3. 磁盘满",
      createdBy: "mock-user",
      createdAt: now,
      updatedAt: now,
      feedbackSummary: {
        total: items.length,
        avgRating: ratings.length === 0 ? null : Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10,
        helpfulCount: items.filter((i) => i.isHelpful === true).length,
        unhelpfulCount: items.filter((i) => i.isHelpful === false).length,
      },
    },
    msg: "操作成功",
  });
});

app.post("/api/v1/knowledges/:id/feedback", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as any;
  if (body.rating !== undefined && body.rating !== null && (body.rating < 1 || body.rating > 5)) {
    return c.json({ ok: false, data: null, msg: "rating 必须是 1-5" }, 400);
  }
  const fb = {
    id: `kf-${Date.now()}`,
    knowledgeId: id,
    rating: body.rating ?? null,
    isHelpful: body.isHelpful ?? null,
    comment: body.comment ?? null,
    tags: body.tags ?? null,
    source: body.source ?? "agent-workstation",
    externalRunId: body.externalRunId ?? null,
    createdAt: new Date().toISOString(),
  };
  knowledgeFeedbacks.push(fb);
  console.log(`[mock-arm] knowledge feedback: knowledge=${id} rating=${fb.rating}`);
  if (fb.rating !== null && fb.rating <= 3) {
    notifications.push({
      id: `n-${Date.now()}`,
      userId: "mock-user",
      type: "knowledge_feedback",
      refId: id,
      refName: "故障知识库",
      title: `Knowledge "故障知识库" 收到 ${fb.rating} 星评价`,
      body: fb.comment,
      meta: { rating: fb.rating },
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }
  return c.json({ ok: true, data: fb, msg: "反馈已记录" }, 201);
});

app.get("/api/v1/knowledges/:id/feedback", (c) => {
  const id = c.req.param("id");
  const items = knowledgeFeedbacks.filter((f) => f.knowledgeId === id);
  return c.json({ ok: true, data: { total: items.length, items }, msg: "操作成功" });
});

// ──────────── 修改 Agent (作者用) ────────────
app.put("/api/v1/agents/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as any;
  const idx = agents.findIndex((a) => a.id === id);
  if (idx === -1) return c.json({ ok: false, data: null, msg: "Agent 不存在" }, 404);
  const a = agents[idx];
  if (typeof body.prompt === "string") {
    a.prompt = body.prompt;
    // 版本号 patch + 0.1
    const v = a.version.split(".").map(Number);
    v[2] = (v[2] ?? 0) + 1;
    a.version = v.join(".");
  }
  if (typeof body.description === "string") a.description = body.description;
  if (typeof body.name === "string") a.name = body.name;
  if (typeof body.status === "string") a.status = body.status;
  if (typeof body.avatar === "string") a.avatar = body.avatar;
  a.updatedAt = new Date().toISOString();
  console.log(`[mock-arm] agent updated: ${a.name} v${a.version}`);
  return c.json({ ok: true, data: a, msg: "更新成功，版本号已递增" });
});

// ──────────── 通知 ────────────
app.get("/api/v1/notifications", (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ ok: false, data: null, msg: "userId 必填" }, 400);
  const unreadOnly = c.req.query("unreadOnly") === "true";
  const items = notifications.filter((n) => n.userId === userId && (!unreadOnly || !n.isRead));
  const unreadCount = notifications.filter((n) => n.userId === userId && !n.isRead).length;
  return c.json({
    ok: true,
    data: {
      unreadCount,
      total: items.length,
      items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    },
    msg: "操作成功",
  });
});

app.post("/api/v1/notifications/:id/read", (c) => {
  const id = c.req.param("id");
  const n = notifications.find((x) => x.id === id);
  if (!n) return c.json({ ok: false, data: null, msg: "通知不存在" }, 404);
  n.isRead = true;
  n.readAt = new Date().toISOString();
  return c.json({ ok: true, data: { id: n.id, isRead: true }, msg: "已读" });
});

app.put("/api/v1/notifications/read-all/read", (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ ok: false, data: null, msg: "userId 必填" }, 400);
  let count = 0;
  for (const n of notifications) {
    if (n.userId === userId && !n.isRead) {
      n.isRead = true;
      n.readAt = new Date().toISOString();
      count++;
    }
  }
  return c.json({ ok: true, data: { markedCount: count }, msg: "已全部标记" });
});

console.log(`[mock-arm] listening on http://localhost:${port}`);
console.log(`[mock-arm] agents: ${agents.length}`);

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });