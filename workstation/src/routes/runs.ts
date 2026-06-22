import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { workspaceRepo } from "../db/repos/workspace.repo.ts";
import { runRepo } from "../db/repos/run.repo.ts";
import { messageRepo } from "../db/repos/message.repo.ts";
import { eventRepo } from "../db/repos/event.repo.ts";
import { arm } from "../arm-client/client.ts";
import { executeRun } from "../execution/agent-runner.ts";
import { buildSystemPrompt } from "../execution/context-builder.ts";
import { workspaceCwdPath } from "../execution/built-in-tools.ts";
import { ok, fail } from "../utils/response.ts";

export const runsRoute = new Hono();

/**
 * 创建 Run + 首条 user 消息 → 立刻执行 → SSE 流式返回
 *
 * POST /api/ws/workspaces/:workspaceId/runs
 * Body: { message: string }
 */
runsRoute.post("/workspaces/:workspaceId/runs", async (c) => {
  const wsId = c.req.param("workspaceId");
  const workspace = workspaceRepo.get(wsId);
  if (!workspace) return c.json(fail("工作空间不存在"), 404);

  const body = (await c.req.json().catch(() => ({}))) as { message?: string };
  if (!body.message || !body.message.trim()) {
    return c.json(fail("message 必填"), 400);
  }

  const agentDetail = await arm().getAgent(workspace.agentId);
  if (!agentDetail) return c.json(fail("ARM 不可达或 Agent 不存在"), 502);

  const systemPrompt = buildSystemPrompt(agentDetail, workspace.context, {
    enableTools: workspace.enableTools,
    cwd: workspace.cwd ?? workspaceCwdPath(workspace.id),
  });

  const run = runRepo.create({
    workspaceId: workspace.id,
    agentId: workspace.agentId,
    agentVersion: workspace.agentVersion ?? agentDetail.version ?? "1.0.0",
    systemPrompt,
    skillBindings: agentDetail.skillBindings ?? [],
    knowledgeBindings: agentDetail.knowledgeBindings ?? [],
    toolsSnapshot: [
      { name: "arm_cli", description: "ARM CLI 命令执行" },
      ...((agentDetail.skillBindings ?? []).map((b) => ({
        name: `skill:${b.skillName ?? b.skillId}`,
        description: `已绑定 Skill v${b.version}`,
      }))),
    ],
  });

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (s) => {
    const send = (event: string, data: unknown) => {
      s.writeSSE({
        event,
        data: JSON.stringify({ runId: run.id, ...((data as object) ?? {}) }),
      });
    };

    send("run.created", { runId: run.id });

    const result = await executeRun({
      run,
      userMessage: body.message!.trim(),
      sender: send,
    });

    send("run.done", { status: result.status, durationMs: result.durationMs });
  });
});

/**
 * 追加 user 消息（续接 Run），并流式返回后续 Agent 输出
 */
runsRoute.post("/runs/:id/messages", async (c) => {
  const runId = c.req.param("id");
  const run = runRepo.get(runId);
  if (!run) return c.json(fail("Run 不存在"), 404);
  if (run.status === "streaming" || run.status === "loading" || run.status === "tool_calling") {
    return c.json(fail("Run 进行中，请先 abort"), 409);
  }
  const body = (await c.req.json().catch(() => ({}))) as { message?: string };
  if (!body.message || !body.message.trim()) return c.json(fail("message 必填"), 400);

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  return streamSSE(c, async (s) => {
    const send = (event: string, data: unknown) => {
      s.writeSSE({
        event,
        data: JSON.stringify({ runId, ...((data as object) ?? {}) }),
      });
    };
    const result = await executeRun({
      run,
      userMessage: body.message!.trim(),
      sender: send,
    });
    send("run.done", { status: result.status, durationMs: result.durationMs });
  });
});

runsRoute.get("/runs/:id", (c) => {
  const run = runRepo.get(c.req.param("id"));
  if (!run) return c.json(fail("Run 不存在"), 404);
  const messages = messageRepo.listByRun(run.id);
  const events = eventRepo.listByRun(run.id);
  return c.json(ok({ ...run, messages, events }));
});

runsRoute.get("/runs/:id/messages", (c) => {
  const run = runRepo.get(c.req.param("id"));
  if (!run) return c.json(fail("Run 不存在"), 404);
  return c.json(ok(messageRepo.listByRun(run.id)));
});

runsRoute.get("/runs/:id/events", (c) => {
  const run = runRepo.get(c.req.param("id"));
  if (!run) return c.json(fail("Run 不存在"), 404);
  return c.json(ok(eventRepo.listByRun(run.id)));
});

runsRoute.get("/workspaces/:workspaceId/runs", (c) => {
  const id = c.req.param("workspaceId");
  const list = runRepo.listByWorkspace(id);
  return c.json(ok(list));
});

runsRoute.post("/runs/:id/abort", (c) => {
  const id = c.req.param("id");
  const run = runRepo.get(id);
  if (!run) return c.json(fail("Run 不存在"), 404);
  runRepo.updateStatus(id, "aborted");
  // 实际中断由 AgentRunner.abort()，这里只标状态
  return c.json(ok({ id, status: "aborted" }));
});