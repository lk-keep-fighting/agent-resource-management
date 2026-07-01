import { Hono } from "hono";
import { ArmClient } from "../arm-client/client.ts";
import { ok, fail } from "../utils/response.ts";

export const authRoute = new Hono();

/**
 * POST /api/ws/auth/login
 * Body: { apiKey }
 * 透传 ARM 登录（公开端点，自身不需要 token）
 */
authRoute.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { apiKey?: string };
  if (!body.apiKey) return c.json(fail("apiKey 必填"), 400);
  const client = new ArmClient();
  const data = await client.login(body.apiKey);
  if (!data) return c.json(fail("ARM 不可达"), 502);
  return c.json(ok(data));
});

/**
 * GET /api/ws/auth/me
 * 验证当前 token，返回 user 信息（公开端点，token 由 header 提供）
 */
authRoute.get("/me", async (c) => {
  const apiKey = c.req.header("Authorization")?.slice(7);
  if (!apiKey) return c.json(fail("缺少 Authorization"), 401);
  const client = new ArmClient(undefined, apiKey);
  const me = await client.getMe();
  if (!me) return c.json(fail("Token 无效或 ARM 不可达"), 401);
  return c.json(ok(me));
});