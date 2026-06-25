import { Hono } from "hono";
import { runRepo } from "../db/repos/run.repo.ts";
import { arm } from "../arm-client/client.ts";
import { ok, fail } from "../utils/response.ts";

export const miscRoute = new Hono();

/**
 * GET /api/ws/my-agents?createdBy=xxx
 * 透传到 ARM /agents/mine
 */
miscRoute.get("/my-agents", async (c) => {
  const createdBy = c.req.query("createdBy");
  if (!createdBy) return c.json(fail("createdBy 必填"), 400);
  const data = await arm().getMyAgents(createdBy);
  if (!data) return c.json(fail("ARM 不可达"), 502);
  return c.json(ok(data));
});

/**
 * GET /api/ws/notifications?userId=xxx&unreadOnly=true
 */
miscRoute.get("/notifications", async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json(fail("userId 必填"), 400);
  const unreadOnly = c.req.query("unreadOnly") === "true";
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 50;
  const data = await arm().getNotifications(userId, { unreadOnly, limit });
  if (!data) return c.json(fail("ARM 不可达"), 502);
  return c.json(ok(data));
});

/**
 * GET /api/ws/notifications/unread?userId=xxx
 * 轻量接口，仅返回未读数（顶栏铃铛用）
 */
miscRoute.get("/notifications/unread", async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json(fail("userId 必填"), 400);
  const data = await arm().getNotifications(userId, { unreadOnly: true, limit: 1 });
  return c.json(ok({ count: data?.unreadCount ?? 0 }));
});

/**
 * POST /api/ws/notifications/:id/read
 */
miscRoute.post("/notifications/:id/read", async (c) => {
  const id = c.req.param("id");
  await arm().markNotificationRead(id);
  return c.json(ok({ id, isRead: true }));
});

/**
 * POST /api/ws/notifications/read-all
 * Body: { userId }
 */
miscRoute.post("/notifications/read-all", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { userId?: string };
  if (!body.userId) return c.json(fail("userId 必填"), 400);
  const r = await arm().markAllNotificationsRead(body.userId);
  return c.json(ok(r ?? { markedCount: 0 }));
});

/**
 * GET /api/ws/skills/:name
 * 透传 skill 详情（含 feedbackSummary）
 */
miscRoute.get("/skills/:name", async (c) => {
  const data = await arm().getSkill(c.req.param("name"));
  if (!data) return c.json(fail("Skill 不存在"), 404);
  return c.json(ok(data));
});

/**
 * GET /api/ws/skills/:id/feedback
 */
miscRoute.get("/skills/:id/feedback", async (c) => {
  const data = await arm().getSkillFeedbacks(c.req.param("id"));
  if (!data) return c.json(fail("ARM 不可达"), 502);
  return c.json(ok(data));
});

/**
 * POST /api/ws/skills/:id/feedback
 */
miscRoute.post("/skills/:id/feedback", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as any;
  const created = await arm().createSkillFeedback(id, body);
  if (!created) return c.json(fail("提交失败"), 502);
  return c.json(ok(created), 201);
});

/**
 * GET /api/ws/knowledges/:id
 */
miscRoute.get("/knowledges/:id", async (c) => {
  const data = await arm().getKnowledgeById(c.req.param("id"));
  if (!data) return c.json(fail("Knowledge 不存在"), 404);
  return c.json(ok(data));
});

/**
 * GET /api/ws/knowledges/:id/feedback
 */
miscRoute.get("/knowledges/:id/feedback", async (c) => {
  const data = await arm().getKnowledgeFeedbacks(c.req.param("id"));
  if (!data) return c.json(fail("ARM 不可达"), 502);
  return c.json(ok(data));
});

/**
 * POST /api/ws/knowledges/:id/feedback
 */
miscRoute.post("/knowledges/:id/feedback", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as any;
  const created = await arm().createKnowledgeFeedback(id, body);
  if (!created) return c.json(fail("提交失败"), 502);
  return c.json(ok(created), 201);
});

/**
 * PUT /api/ws/agents/:id  (作者修改 prompt / description / avatar)
 */
miscRoute.put("/agents/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as any;
  const updated = await arm().updateAgent(id, body);
  if (!updated) return c.json(fail("更新失败"), 502);
  return c.json(ok(updated));
});

/**
 * GET /api/ws/agents/:id/feedback
 * 透传 ARM 的反馈列表（含 summary + items）
 */
miscRoute.get("/agents/:id/feedback", async (c) => {
  const id = c.req.param("id");
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);
  const data = await arm().getAgentFeedbacks(id, limit);
  if (!data) return c.json(fail("ARM 不可达"), 502);
  return c.json(ok(data));
});

/**
 * GET /api/ws/me/history?limit=20
 * 返回当前用户最近用过的 Agent（来自 ws_run 聚合）
 */
miscRoute.get("/me/history", (c) => {
  const limit = Number(c.req.query("limit") ?? "20");
  // 从 ws_run 聚合：每个 agent 取最新一次 run
  const runs = runRepo.listAllRecent(limit * 3);
  const byAgent = new Map<string, { agentId: string; agentName: string; lastRunAt: number; runCount: number }>();
  for (const r of runs) {
    const cur = byAgent.get(r.agentId);
    if (cur) {
      cur.runCount += 1;
    } else {
      byAgent.set(r.agentId, {
        agentId: r.agentId,
        agentName: r.agentName ?? r.agentId,
        lastRunAt: r.createdAt,
        runCount: 1,
      });
    }
  }
  const items = Array.from(byAgent.values())
    .sort((a, b) => b.lastRunAt - a.lastRunAt)
    .slice(0, limit);
  return c.json(ok({ total: items.length, items }));
});