import { Hono } from "hono";
import { config } from "../config.ts";
import { ok, fail } from "../utils/response.ts";

export const authSsoRoute = new Hono();

/**
 * GET /api/ws/auth/login-url
 * 返回 ARM 入口（`/api/auth/login?wsCallback=<this workstation's callback>`）。
 * 前端 window.location.href = loginUrl 即可触发登录。
 */
authSsoRoute.get("/login-url", (c) => {
  const origin = c.req.header("x-forwarded-proto") && c.req.header("x-forwarded-host")
    ? `${c.req.header("x-forwarded-proto")}://${c.req.header("x-forwarded-host")}`
    : `${new URL(c.req.url).protocol}//${new URL(c.req.url).host}`;
  const wsCallback = `${origin}/#/auth/sso-callback`;
  const armLogin = `${config.arm.baseUrl.replace(/\/+$/, "")}/api/auth/login?wsCallback=${encodeURIComponent(wsCallback)}`;
  return c.json(ok({ loginUrl: armLogin }));
});

/**
 * GET /api/ws/auth/callback?token=arm_pat_xxx
 * ARM 中间跳转页把 PAT 放在 fragment 里，本端点用 query 收（前端会先 parse hash 再请求）
 * 这里提供一个调试入口（手动测试用），实际生产中前端 hash 解析后存 sessionStorage 即可。
 */
authSsoRoute.get("/callback", (c) => {
  const token = c.req.query("token");
  if (!token?.startsWith("arm_pat_")) return c.json(fail("token 缺失或格式错误"), 400);
  return c.json(ok({ token }));
});