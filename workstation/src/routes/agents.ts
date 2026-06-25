import { Hono } from "hono";
import { arm } from "../arm-client/client.ts";
import { ok, fail } from "../utils/response.ts";
import { workspaceRepo } from "../db/repos/workspace.repo.ts";

export const agentsRoute = new Hono();

agentsRoute.get("/", async (c) => {
  const keyword = c.req.query("keyword");
  const page = Number(c.req.query("page") ?? "1");
  const pageSize = Number(c.req.query("pageSize") ?? "50");
  const data = await arm().listAgents({ keyword, page, pageSize });
  if (!data) return c.json(fail("ARM 不可达"), 502);
  // 给每个 Agent 加上：我的 workspace 数 + ARM 的 feedbackSummary
  // 两个独立的 N+1，并行发请求（数量级通常 10-30，可接受）
  const agents = await Promise.all(
    data.agents.map(async (a) => {
      const [workspaceCount, detail] = await Promise.all([
        Promise.resolve(workspaceRepo.countByAgent(a.id)),
        arm().getAgent(a.id),
      ]);
      return {
        ...a,
        workspaceCount,
        feedbackSummary: detail?.feedbackSummary ?? null,
      };
    }),
  );
  return c.json(ok({ ...data, agents }));
});

agentsRoute.get("/:id", async (c) => {
  const agent = await arm().getAgent(c.req.param("id"));
  if (!agent) return c.json(fail("Agent 不存在"), 404);
  const myWorkspaces = workspaceRepo.listByAgent(agent.id);
  return c.json(
    ok({
      ...agent,
      myWorkspaces,
    }),
  );
});