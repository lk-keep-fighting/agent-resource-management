import type { Context, Next } from "hono";
import { setArmToken } from "../arm-client/client.ts";

/**
 * Auth middleware（极简）
 *
 * 客户端登录后存 { apiKey, userId } 到 localStorage。
 * 每个请求带：
 *   Authorization: Bearer <apiKey>   (用于前端调 ARM 时携带)
 *   X-User-Id: <userId>              (workstation 信任此 header 做数据隔离)
 *
 * 未登录请求 → 401。
 */
export async function requireAuth(c: Context, next: Next) {
  const userId = c.req.header("X-User-Id");
  const auth = c.req.header("Authorization");
  if (!userId || !auth?.startsWith("Bearer ")) {
    return c.json(
      { ok: false, data: null, msg: "未登录：缺少 X-User-Id 或 Authorization" },
      401,
    );
  }
  const token = auth.slice(7);
  c.set("userId", userId);
  c.set("apiKey", token);
  setArmToken(token);  // 让后续 arm() 调用带这个 token
  try {
    await next();
  } finally {
    setArmToken(null);  // 请求结束清空
  }
}