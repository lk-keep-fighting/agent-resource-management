import { Hono } from "hono";
import { runRepo } from "../db/repos/run.repo.ts";
import { armForContext } from "../arm-client/client.ts";
import { ok, fail } from "../utils/response.ts";

export const feedbackRoute = new Hono();

/**
 * 提交 Run 评分反馈 —— 直接透传到 ARM 后端
 *
 * POST /api/ws/runs/:id/feedback
 * Body: { rating?, isHelpful?, comment?, tags? }
 */
feedbackRoute.post("/runs/:id/feedback", async (c) => {
  const runId = c.req.param("id");
  const run = runRepo.get(runId);
  if (!run) return c.json(fail("Run 不存在"), 404);

  const body = (await c.req.json().catch(() => ({}))) as {
    rating?: number;
    isHelpful?: boolean;
    comment?: string;
    tags?: string[];
  };

  if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) {
    return c.json(fail("rating 必须是 1-5"), 400);
  }

  const created = await armForContext(c).createAgentFeedback(run.agentId, {
    rating: body.rating ?? null,
    isHelpful: body.isHelpful ?? null,
    comment: body.comment ?? null,
    tags: body.tags ?? null,
    agentVersion: run.agentVersion,
    externalRunId: runId,
    source: "agent-workstation",
  });
  if (!created) {
    return c.json(fail("ARM 不可达或提交失败"), 502);
  }
  return c.json(
    ok({
      id: created.id,
      runId,
      agentId: run.agentId,
      rating: body.rating ?? null,
      isHelpful: body.isHelpful ?? null,
      comment: body.comment ?? null,
      tags: body.tags ?? null,
    }),
    201,
  );
});