import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { workspaceRepo } from "../db/repos/workspace.repo.ts";
import { runRepo } from "../db/repos/run.repo.ts";
import { messageRepo } from "../db/repos/message.repo.ts";
import { eventRepo } from "../db/repos/event.repo.ts";
import { armForContext } from "../arm-client/client.ts";
import { executeRun } from "../execution/agent-runner.ts";
import { buildSystemPrompt } from "../execution/context-builder.ts";
import { workspaceCwdPath } from "../execution/built-in-tools.ts";
import { getRunner } from "../execution/runner-registry.ts";
import { chatComplete } from "../execution/llm.ts";
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

  const body = (await c.req.json().catch(() => ({}))) as {
    message?: string;
    pinnedExperienceIds?: string[];
  };
  if (!body.message || !body.message.trim()) {
    return c.json(fail("message 必填"), 400);
  }

  const agentDetail = await armForContext(c).getAgent(workspace.agentId);
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
      historyMode: "fresh",  // 新 run：注入 workspace 全部历史消息
      pinnedExperienceIds:
        Array.isArray(body.pinnedExperienceIds) ? body.pinnedExperienceIds : undefined,
      armClient: armForContext(c),
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
  const body = (await c.req.json().catch(() => ({}))) as {
    message?: string;
    pinnedExperienceIds?: string[];
  };
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
      historyMode: "continue",  // 续接该 run 已有消息
      pinnedExperienceIds:
        Array.isArray(body.pinnedExperienceIds) ? body.pinnedExperienceIds : undefined,
      armClient: armForContext(c),
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

  // 1) 先看 runner-registry：当前是否真的有 AgentRunner 在跑
  //    - 找到了：直接调 runner.abort()，让 agent 推理立刻停止
  //    - 找不到：只更新 DB 状态（处理已结束的 run / 服务重启后残留）
  const runner = getRunner(id);
  if (runner) {
    runner.abort();
    // runner.abort() → agent.prompt() 抛错 → executeRun 的 catch 块会
    //   1) runRepo.updateStatus(id, "aborted")
    //   2) sender("run.done", { status: "aborted" })
    // 不需要在这里再 updateStatus，避免 race
    return c.json(ok({ id, status: "aborting", source: "runner" }));
  }

  runRepo.updateStatus(id, "aborted");
  return c.json(ok({ id, status: "aborted", source: "db-only" }));
});

/**
 * 清空工作空间的所有消息（保留 ws_run 记录 —— 历史、标题、状态、统计都还在）。
 *
 * POST /api/ws/workspaces/:workspaceId/clear
 * Body: { confirm?: boolean }  - confirm=false 时只返回当前消息数（预览）
 */
runsRoute.post("/workspaces/:workspaceId/clear", async (c) => {
  const wsId = c.req.param("workspaceId");
  const workspace = workspaceRepo.get(wsId);
  if (!workspace) return c.json(fail("工作空间不存在"), 404);

  const body = (await c.req.json().catch(() => ({}))) as { confirm?: boolean };
  const beforeCount = messageRepo
    .listByWorkspace(wsId)
    .filter((m) => m.role === "user" || m.role === "assistant").length;

  if (body.confirm !== true) {
    return c.json(
      ok({
        preview: true,
        messageCount: beforeCount,
        msg: `将清空 ${beforeCount} 条消息（保留所有 run 记录）`,
      }),
    );
  }

  const deleted = messageRepo.deleteByWorkspace(wsId);
  return c.json(ok({ deleted, msg: `已清空 ${deleted} 条消息` }));
});

/**
 * 把工作空间的对话历史调 LLM 总结 → 创建 Knowledge → 绑定到当前 Agent → 清空本地消息。
 *
 * 这样设计的目的：本地 ws 不爆 token，且积累的经验（SOP / Debug / 报告 等）
 * 能被 ARM 当作 Knowledge 沉淀到 agent 上，下次开新 workspace 自动加载。
 *
 * POST /api/ws/workspaces/:workspaceId/summarize
 * Body: { name?: string; confirm?: boolean }
 *   - name: 自定义 knowledge 名称；不传则自动生成 `${agentName}-经验-${ts}`
 *   - confirm: false 时只预览要总结的消息数和生成的标题，不真的调 LLM / ARM
 */
runsRoute.post("/workspaces/:workspaceId/summarize", async (c) => {
  const wsId = c.req.param("workspaceId");
  const workspace = workspaceRepo.get(wsId);
  if (!workspace) return c.json(fail("工作空间不存在"), 404);

  // 1. 收集 user/assistant 消息（按时间序，跨 run 拼接）
  const allMessages = messageRepo.listByWorkspace(wsId);
  const turns = allMessages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));

  if (turns.length === 0) {
    return c.json(fail("没有可总结的对话内容"), 400);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    confirm?: boolean;
  };
  const defaultName = `${workspace.agentName ?? workspace.agentId}-经验-${new Date()
    .toISOString()
    .slice(0, 10)}`;

  // 2. 预览模式：只返回 turn 数和建议标题，不调 LLM
  if (body.confirm !== true) {
    return c.json(
      ok({
        preview: true,
        turnCount: turns.length,
        suggestedName: body.name ?? defaultName,
        msg: `将总结 ${turns.length} 条对话 → 1 条 Knowledge`,
      }),
    );
  }

  // 3. 调 LLM 总结
  // 提示词：先识别知识类型（SOP / Debug 经验 / 报告 / 协议 / 其它），
  //        再用结构化 markdown 沉淀要点。
  const transcript = turns
    .map((t, i) => `[${i + 1}] ${t.role === "user" ? "用户" : "助手"}: ${t.content}`)
    .join("\n\n");

  const systemPrompt = [
    "你是一名经验沉淀助手。给定一段人机对话（用户和 AI 助手），你需要：",
    "1. 先识别这次对话沉淀的知识类型，可选：SOP（标准操作流程）/ Debug 经验（排错经验）/ 报告（结论性总结）/ 协议（接口或约定）/ 其它",
    "2. 把对话中可复用的经验、结论、要点提取出来，去掉寒暄、试错、临时上下文",
    "3. 用结构化 Markdown 输出，包含：",
    "   - `# 标题`（≤ 20 字）",
    "   - `## 类型`（上面 5 选 1）",
    "   - `## 场景`（什么时候适用）",
    "   - `## 关键经验`（3-7 条要点）",
    "   - `## 原文摘要`（1-3 段，可省略）",
    "",
    "输出必须是 Markdown 文本，不要任何开场白、解释、'好的'、'以下是'之类。",
  ].join("\n");

  const userPrompt = `以下是一段需要沉淀的对话：\n\n${transcript}\n\n请直接输出 Markdown 摘要。`;

  let summaryMd: string;
  try {
    summaryMd = await chatComplete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 2048 },
    );
  } catch (e: any) {
    return c.json(fail(`LLM 总结失败: ${e?.message ?? String(e)}`), 502);
  }

  if (!summaryMd) {
    return c.json(fail("LLM 返回空内容"), 502);
  }

  // 4. 创建 Knowledge
  const knowledgeName = body.name?.trim() || defaultName;
  let knowledge: any;
  try {
    knowledge = await armForContext(c).createKnowledge({
      name: knowledgeName,
      description: `从 Workspace "${workspace.name}" 对话历史自动总结（${turns.length} 条消息）`,
      content: summaryMd,
    });
  } catch (e: any) {
    return c.json(fail(`ARM 创建 Knowledge 失败: ${e?.message ?? String(e)}`), 502);
  }
  if (!knowledge?.id) {
    return c.json(fail("ARM 创建 Knowledge 返回空数据"), 502);
  }

  // 5. 绑定到当前 agent（这样下次新开 workspace 时会自动加载）
  let binding: { id: string; version: string } | null = null;
  try {
    binding = await armForContext(c).bindKnowledgeToAgent(workspace.agentId, {
      knowledgeId: knowledge.id,
    });
  } catch (e: any) {
    // binding 失败不阻塞主流程 —— knowledge 已存在，agent 后续可手动绑
    console.warn(
      `[summarize] bindKnowledgeToAgent failed: ${e?.message ?? String(e)}`,
    );
  }

  // 6. 清空本地消息（保留 run 记录）
  const deletedMessages = messageRepo.deleteByWorkspace(wsId);

  return c.json(
    ok({
      knowledge: {
        id: knowledge.id,
        name: knowledge.name,
        url: knowledge.shareUrl ?? `/knowledges/${knowledge.id}`,
      },
      binding: binding ?? null,
      summarizedTurns: turns.length,
      deletedMessages,
      msg: binding
        ? `已沉淀为知识并绑定到 Agent (${binding.version})，清空 ${deletedMessages} 条本地消息`
        : `已沉淀为知识，清空 ${deletedMessages} 条本地消息（绑定失败，可手动绑）`,
    }),
  );
});