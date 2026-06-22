import { Hono } from "hono";
import { arm } from "../arm-client/client.ts";
import { ok, fail } from "../utils/response.ts";

export const authRoute = new Hono();

/**
 * POST /api/ws/auth/login
 * Body: { apiKey }
 * 透传 ARM 登录
 */
authRoute.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { apiKey?: string };
  if (!body.apiKey) return c.json(fail("apiKey 必填"), 400);
  const data = await arm().login(body.apiKey);
  if (!data) return c.json(fail("ARM 不可达"), 502);
  return c.json(ok(data));
});

/**
 * GET /api/ws/auth/me
 * 验证当前 token，返回 user 信息
 *
 * 客户端每次登录后用此 endpoint 验证一次，缓存 userId
 */
authRoute.get("/me", async (c) => {
  const apiKey = c.req.header("Authorization")?.slice(7);
  if (!apiKey) return c.json(fail("缺少 Authorization"), 401);
  // 临时把 token 设进去
  arm().setApiKey(apiKey);
  const me = await arm().getMe();
  if (!me) return c.json(fail("Token 无效或 ARM 不可达"), 401);
  return c.json(ok(me));
});