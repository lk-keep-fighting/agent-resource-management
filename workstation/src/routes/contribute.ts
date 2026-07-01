import { Hono } from "hono";
import { runRepo } from "../db/repos/run.repo.ts";
import { messageRepo } from "../db/repos/message.repo.ts";
import { workspaceRepo } from "../db/repos/workspace.repo.ts";
import { assetShareRepo } from "../db/repos/asset-share.repo.ts";
import { armForContext } from "../arm-client/client.ts";
import { ok, fail } from "../utils/response.ts";

export const contributeRoute = new Hono();

/**
 * 从 Run 沉淀为资产。
 *
 * POST /api/ws/runs/:runId/contribute
 * Body: {
 *   assetType: "knowledge" | "agent",
 *   name: string,
 *   description?: string,
 *   content?: string,         // knowledge 用：可手填，默认从 Run 提取
 *   tags?: string[],
 * }
 */
contributeRoute.post("/runs/:runId/contribute", async (c) => {
  const runId = c.req.param("runId");
  const run = runRepo.get(runId);
  if (!run) return c.json(fail("Run 不存在"), 404);

  const body = (await c.req.json().catch(() => ({}))) as {
    assetType?: "knowledge" | "agent";
    name?: string;
    description?: string;
    content?: string;
    tags?: string[];
  };
  if (!body.assetType || !body.name) return c.json(fail("assetType 和 name 必填"), 400);

  const share = assetShareRepo.create({ fromRunId: runId, assetType: body.assetType });

  try {
    if (body.assetType === "knowledge") {
      const content =
        body.content ??
        extractKnowledgeContent(messageRepo.listByRun(runId));
      const created = await armForContext(c).createKnowledge({
        name: body.name,
        description: body.description ?? "",
        content,
      });
      assetShareRepo.markCreated(share.id, created.id, created.name);
      return c.json(ok({ ...share, armAsset: created }));
    }

    if (body.assetType === "agent") {
      const workspace = workspaceRepo.get(run.workspaceId);
      const created = await armForContext(c).createAgent({
        name: body.name,
        description: body.description ?? "",
        prompt: [workspace?.context, run.systemPrompt].filter(Boolean).join("\n\n"),
        status: "active",
      });
      assetShareRepo.markCreated(share.id, created.id, created.name);
      return c.json(ok({ ...share, armAsset: created }));
    }

    return c.json(fail("未知 assetType 或暂不支持"), 400);
  } catch (e: any) {
    assetShareRepo.markFailed(share.id, e?.message ?? String(e));
    // 不再加 "沉淀失败:" 前缀 —— 前端 catch 已统一加前缀，避免出现 "沉淀失败: 沉淀失败: ..."
    return c.json(fail(e?.message ?? String(e)), 500);
  }
});

contributeRoute.get("/assets", (c) => {
  return c.json(ok(assetShareRepo.list()));
});

contributeRoute.get("/runs/:runId/assets", (c) => {
  const list = assetShareRepo.listByRun(c.req.param("runId"));
  return c.json(ok(list));
});

/**
 * 预览：从 Run 提取的默认内容（前端"沉淀向导"用）
 */
contributeRoute.get("/runs/:runId/extract", (c) => {
  const run = runRepo.get(c.req.param("runId"));
  if (!run) return c.json(fail("Run 不存在"), 404);
  const messages = messageRepo.listByRun(run.id);
  return c.json(
    ok({
      knowledgeDefault: extractKnowledgeContent(messages),
      agentDefault: {
        name: run.title ?? `${run.agentId}-copy`,
        description: "",
        prompt: run.systemPrompt,
      },
    }),
  );
});

function extractKnowledgeContent(messages: Array<{ role: string; content: string | null }>): string {
  const assistants = messages.filter((m) => m.role === "assistant" && m.content);
  if (assistants.length === 0) return "";
  return `# 从对话沉淀\n\n${assistants
    .map((m, i) => `## 第 ${i + 1} 轮回答\n\n${m.content}`)
    .join("\n\n---\n\n")}`;
}