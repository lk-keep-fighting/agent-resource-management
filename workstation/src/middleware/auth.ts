import type { Context, Next } from "hono";

/**
 * Auth middleware（极简）
 *
 * 客户端登录后存 { apiKey, userId } 到 localStorage。
 * 每个请求带：
 *   Authorization: Bearer <apiKey>   (用于前端调 ARM 时携带)
 *   X-User-Id: <userId>              (workstation 信任此 header 做数据隔离)
 *
 * 未登录请求 → 401。
 *
 * 把 token 放进 c.var.token，handler 端通过 armForContext(c) 取出
 * 构造带身份的 ArmClient。
 */
type WsContextEnv = { Variables: { token?: string } };

export async function requireAuth(c: Context<WsContextEnv>, next: Next) {
  const userId = c.req.header("X-User-Id");
  const auth = c.req.header("Authorization");
  if (!userId || !auth?.startsWith("Bearer ")) {
    return c.json(
      { ok: false, data: null, msg: "未登录：缺少 X-User-Id 或 Authorization" },
      401,
    );
  }
  c.set("token", auth.slice(7));
  // （X-User-Id 仍然信任，用于本地数据隔离；此为现有约定，本方案不动）
  await next();
}
