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
  // 走批量接口，避免 N+1（pageSize=100 时从 1+100×2=201 次调用降到 3 次）
  const agentIds = data.agents.map((a) => a.id);
  const [workspaceCounts, summaryMap] = await Promise.all([
    Promise.resolve(workspaceRepo.countByAgentIds(agentIds)),
    arm().batchAgentSummary(agentIds),
  ]);
  const agents = data.agents.map((a) => ({
    ...a,
    workspaceCount: workspaceCounts[a.id] ?? 0,
    feedbackSummary: summaryMap[a.id] ?? null,
  }));
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