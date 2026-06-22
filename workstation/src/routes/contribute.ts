import { Hono } from "hono";
import { runRepo } from "../db/repos/run.repo.ts";
import { messageRepo } from "../db/repos/message.repo.ts";
import { workspaceRepo } from "../db/repos/workspace.repo.ts";
import { assetShareRepo } from "../db/repos/asset-share.repo.ts";
import { arm } from "../arm-client/client.ts";
import { ok, fail } from "../utils/response.ts";

export const contributeRoute = new Hono();

/**
 * 从 Run 沉淀为资产。
 *
 * POST /api/ws/runs/:runId/contribute
 * Body: {
 *   assetType: "skill" | "knowledge" | "agent",
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
    assetType?: "skill" | "knowledge" | "agent";
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
      const created = await arm().createKnowledge({
        name: body.name,
        description: body.description ?? "",
        content,
      });
      if (!created) throw new Error("ARM 创建 Knowledge 失败");
      assetShareRepo.markCreated(share.id, created.id, created.name);
      return c.json(ok({ ...share, armAsset: created }));
    }

    if (body.assetType === "agent") {
      const workspace = workspaceRepo.get(run.workspaceId);
      const created = await arm().createAgent({
        name: body.name,
        description: body.description ?? "",
        prompt: [workspace?.context, run.systemPrompt].filter(Boolean).join("\n\n"),
        status: "active",
      });
      if (!created) throw new Error("ARM 创建 Agent 失败");
      assetShareRepo.markCreated(share.id, created.id, created.name);
      return c.json(ok({ ...share, armAsset: created }));
    }

    if (body.assetType === "skill") {
      // MVP：上传 Skill 需要 ZIP 文件 + SKILL.md；此处仅创建草稿记录，待 CLI 上传
      // 简化处理：返回 share 记录，前端可让用户用 `arm skill upload` 完成
      const shareCur = assetShareRepo.get(share.id)!;
      return c.json(
        ok({
          ...shareCur,
          hint:
            "Skill 暂需使用 ARM CLI 上传 ZIP。运行: arm skill upload <path>",
        }),
      );
    }

    return c.json(fail("未知 assetType"), 400);
  } catch (e: any) {
    assetShareRepo.markFailed(share.id, e?.message ?? String(e));
    return c.json(fail(`沉淀失败: ${e?.message ?? String(e)}`), 500);
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
      skillDefault: extractSkillSnippet(messages),
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

function extractSkillSnippet(messages: Array<{ role: string; content: string | null }>): string {
  // 简化：摘出含 ```code``` 的 assistant 内容
  const blocks: string[] = [];
  for (const m of messages) {
    if (m.role !== "assistant" || !m.content) continue;
    const re = /```[\w]*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(m.content))) {
      blocks.push(match[1]);
    }
  }
  return blocks.join("\n\n");
}