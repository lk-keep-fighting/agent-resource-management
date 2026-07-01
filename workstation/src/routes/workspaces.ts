import { Hono } from "hono";
import { workspaceRepo } from "../db/repos/workspace.repo.ts";
import { armForContext } from "../arm-client/client.ts";
import { workspaceCwdPath } from "../execution/built-in-tools.ts";
import { ok, fail } from "../utils/response.ts";

export const workspacesRoute = new Hono();

workspacesRoute.get("/", (c) => {
  const userId = c.get("userId" as never) as string | undefined;
  const items = workspaceRepo.list(userId).map((w) => ({
    ...w,
    runCount: undefined as number | undefined,
  }));
  return c.json(ok(items));
});

workspacesRoute.get("/agent/:agentId", (c) => {
  const userId = c.get("userId" as never) as string | undefined;
  const items = workspaceRepo.listByAgent(c.req.param("agentId"), userId);
  return c.json(ok(items));
});

workspacesRoute.get("/:id", (c) => {
  const userId = c.get("userId" as never) as string | undefined;
  const ws = workspaceRepo.get(c.req.param("id"), userId);
  if (!ws) return c.json(fail("工作空间不存在"), 404);
  return c.json(ok(ws));
});

workspacesRoute.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    agentId?: string;
    name?: string;
    context?: string;
    settings?: Record<string, unknown>;
    enableTools?: boolean;
  };
  if (!body.agentId || !body.name) {
    return c.json(fail("agentId 和 name 必填"), 400);
  }
  const userId = c.get("userId" as never) as string | undefined;
  const agent = await armForContext(c).getAgent(body.agentId);
  if (!agent) return c.json(fail("Agent 不存在或 ARM 不可达"), 404);

  const temp = workspaceRepo.create({
    userId: userId ?? null,
    agentId: body.agentId,
    agentVersion: agent.version,
    agentName: agent.name,
    agentAvatar: agent.avatar ?? null,
    name: body.name,
    context: body.context ?? null,
    settings: body.settings ?? null,
    enableTools: body.enableTools ?? false,
  });
  const cwd = workspaceCwdPath(temp.id);
  const ws = workspaceRepo.setCwd(temp.id, cwd) ?? temp;
  return c.json(ok(ws), 201);
});

workspacesRoute.put("/:id", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    context?: string;
    settings?: Record<string, unknown>;
    enableTools?: boolean;
  };
  const ws = workspaceRepo.update(c.req.param("id"), body);
  if (!ws) return c.json(fail("工作空间不存在"), 404);
  return c.json(ok(ws));
});

workspacesRoute.delete("/:id", (c) => {
  const ok2 = workspaceRepo.delete(c.req.param("id"));
  if (!ok2) return c.json(fail("工作空间不存在"), 404);
  return c.json(ok({ id: c.req.param("id") }));
});