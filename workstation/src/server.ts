import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { config, ensureConfig } from "./config.ts";
import { runMigrations } from "./db/migrate.ts";
import { ArmClient } from "./arm-client/client.ts";
import { workspacesRoute } from "./routes/workspaces.ts";
import { agentsRoute } from "./routes/agents.ts";
import { runsRoute } from "./routes/runs.ts";
import { feedbackRoute } from "./routes/feedback.ts";
import { contributeRoute } from "./routes/contribute.ts";
import { configRoute } from "./routes/config.ts";
import { miscRoute } from "./routes/misc.ts";
import { authRoute } from "./routes/auth.ts";
import { authSsoRoute } from "./routes/auth-sso.ts";
import { requireAuth } from "./middleware/auth.ts";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

ensureConfig();
runMigrations();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new Hono();

// ─────────── 中间件 ───────────
app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
});
app.options("*", (c) => c.body(null, 204));

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`[${c.req.method}] ${c.req.path} ${c.res.status} ${ms}ms`);
});

// ─────────── 透传当前登录用户的 ARM token ───────────
// 旧实现：在 /api/ws/* 拦截请求并用 setArmToken() 注入到模块级 _currentToken。
// 该机制并发不安全，已被 requireAuth 的 c.set('token', ...) + armForContext(c) 替代。
// 此处保留 hook 点（如未来需要补充 WS-level 上下文，可在此加），不重复注入。
// app.use("/api/ws/*", async (_c, next) => { await next(); });

// ─────────── 健康检查 ───────────
app.get("/health", async (c) => {
  const armReachable = await new ArmClient().health().catch(() => false);
  return c.json({
    ok: true,
    data: {
      service: "agent-workstation",
      version: "0.1.0",
      armReachable,
      llmConfigured: !!config.llm.apiKey,
    },
    msg: "ok",
  });
});

// ─────────── SSO 配置（公开） ───────────
// 注意：必须在 requireAuth 之外定义
app.get("/api/ws/config/sso", (c) => {
  // 流程：workstation → ARM dashboard /login?next=WS_CALLBACK
  //   → ARM dashboard 走 useSSO 跳 SSO → SSO 回跳 /auth/callback?next=WS_CALLBACK&sso_token=...
  //   → ARM callback page 验 token + 跳 <next>#sso=...
  //   → workstation 解析 hash，存 {token, user} 跳首页
  //
  // WS_PUBLIC_ORIGIN 优先级（决定 SSO 回调地址的 host）：
  //   1. WS_PUBLIC_ORIGIN 环境变量（生产部署强制设置）
  //   2. 从当前请求自动检测（X-Forwarded-Proto + Host，反向代理场景）
  //   3. 兜底 http://localhost:4000（仅本地开发）
  const envOrigin = process.env.WS_PUBLIC_ORIGIN;
  const fwdProto = c.req.header("x-forwarded-proto");
  const fwdHost = c.req.header("x-forwarded-host") ?? c.req.header("host");
  const detectedOrigin = fwdProto && fwdHost
    ? `${fwdProto}://${fwdHost}`
    : `${new URL(c.req.url).protocol}//${fwdHost ?? "localhost:4000"}`;
  const wsOrigin = envOrigin || detectedOrigin;
  const wsCallback = `${wsOrigin}/#/auth/sso-callback`;
  const armLogin = `${config.arm.baseUrl.replace(/\/+$/, "")}/login?next=${encodeURIComponent(wsCallback)}`;

  return c.json({
    ok: true,
    data: {
      ssoUrl: config.arm.ssoUrl,
      armBaseUrl: config.arm.baseUrl,
      wsCallback,
      // 浏览器跳这个 URL 就触发 SSO（经 ARM dashboard 中转）
      loginUrl: armLogin,
      // 调试用：当前生效的 origin 来源
      originSource: envOrigin ? "env" : (fwdHost ? "request" : "fallback"),
    },
    msg: "ok",
  });
});

// ─────────── API 路由 ───────────
const api = new Hono();
// 公开：auth/login + auth/me + auth/login-url + auth/callback
// 把 authRoute 和 authSsoRoute 合并到 combinedAuth（Hono 不允许同 path 挂两次 .route）
const combinedAuth = new Hono();
combinedAuth.route("/", authRoute);
combinedAuth.route("/", authSsoRoute);
api.route("/auth", combinedAuth);
// 其他全部要求鉴权（用通配符匹配子路径，避免 Hono 4.12 /runs vs /runs/* 坑）
api.use("*", requireAuth);
api.route("/agents", agentsRoute);
api.route("/workspaces", workspacesRoute);
// /api/ws/runs/* 和 /api/ws/workspaces/:id/runs
api.route("/", runsRoute);
api.route("/", feedbackRoute);
api.route("/", contributeRoute);
api.route("/", miscRoute);
api.route("/config", configRoute);
app.route("/api/ws", api);

// ─────────── 前端静态资源 ───────────
const publicDir = resolve(__dirname, "../public");
try {
  const indexHtml = readFileSync(resolve(publicDir, "index.html"), "utf8");
  app.get("/", (c) => c.html(indexHtml));
} catch {
  app.get("/", (c) => c.text("workstation public/index.html missing"));
}
app.use(
  "/*",
  serveStatic({
    root: publicDir,
  }),
);

// ─────────── 启动 ───────────
const port = config.server.port;
const host = config.server.host;

console.log(`[workstation] starting on http://${host}:${port}`);
console.log(`[workstation] ARM baseUrl: ${config.arm.baseUrl}`);
console.log(`[workstation] LLM: ${config.llm.provider} ${config.llm.defaultModel}`);

serve({
  fetch: app.fetch,
  port,
  hostname: host,
});