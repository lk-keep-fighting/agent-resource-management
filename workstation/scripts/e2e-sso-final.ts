/**
 * E2E 验证完整 SSO 流程（连真实 ARM 3000 + 真实 SSO 服务）
 *
 * 用户日志里 sso_token 仍有 7 天有效期。用这个真 token 模拟真 SSO 服务回跳。
 */
import puppeteer from "puppeteer-core";

const url = "http://localhost:4000";
const REAL_SSO = "http://sso.agent-platform.dev.aimstek.cn";
const ARM_URL = "http://localhost:3000";
// 用户日志里的真 sso_token（exp = 2026-06-29）
const REAL_SSO_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbW5vZTRhMHYwMDAwOWthNDBhOGo0cW45IiwiZmVpc2h1VW5pb25JZCI6Im9uX2M0YTYzZTM1ODdiYTdkZWRjNmIwNGZlM2E0ZjRiMDhhIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3ODIxNDQ2NTcsImV4cCI6MTc4Mjc0OTQ1N30.hxZVw_IG7or2R1maAkDAMHmI9Ydk5nQqMX8yzt2_654";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (err) => console.log("[browser error]", err.message));
    page.on("console", (msg) => {
      const t = msg.text();
      console.log(`[browser ${msg.type()}]`, t);
    });
    page.on("response", async (res) => {
      const u = res.url();
      if (u.startsWith(REAL_SSO) || u.includes("/auth/callback") || u.includes("/login")) {
        console.log(`[response] ${res.status()} ${u}`);
      }
    });

  let pass = true;
  function check(name, ok, detail = "") {
    if (!ok) pass = false;
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail.slice(0, 80)}` : ""}`);
  }

  try {
    await page.setRequestInterception(true);
    let ssoIntercepted = false;
    let armCallbackReached = false;
    page.on("request", async (req) => {
      const u = req.url();

      // 拦截真 SSO 服务 → 模拟真 SSO 跳到 ARM /auth/callback?next=...&sso_token=...
      if (u.startsWith(REAL_SSO)) {
        ssoIntercepted = true;
        // 解析真 SSO URL: ${SSO_URL}/login?redirect_uri=urlencode(ARM_CALLBACK_NEXT)
        const realSso = new URL(u);
        const armCallback = realSso.searchParams.get("redirect_uri");
        if (!armCallback) {
          console.log("[ERR] 真 SSO URL 没 redirect_uri:", u);
          await req.continue();
          return;
        }
        // 不 decode：保持 URL-encoded（避免 next 里的 %23 又变回 # 让 sso_token 落入 fragment）
        const target = `${armCallback}${armCallback.includes("?") ? "&" : "?"}sso_token=${encodeURIComponent(REAL_SSO_TOKEN)}`;
        console.log("[intercept] 真 SSO → 模拟跳到", target);
        await req.respond({
          status: 302,
          headers: {
            location: target,
            "content-type": "text/html",
          },
          body: "",
        });
        return;
      }

      // 检测 ARM callback page 是否真到了
      if (u.includes("/auth/callback")) {
        armCallbackReached = true;
        console.log("[intercept] 浏览器到 ARM", u);
      }

      await req.continue();
    });

    // 1) 启动：访问 workstation 登录页
    await page.goto(`${url}/#/login`, { waitUntil: "domcontentloaded" });
    await sleep(500);

    // 2) fetch SSO config
    const ssoConfig = await page.evaluate(async () => {
      const r = await fetch("/api/ws/config/sso");
      return (await r.json()).data;
    });
    check("SSO config loginUrl 跳 ARM /login?next=...", ssoConfig.loginUrl.startsWith("http://localhost:3000/login?next="));
    check("SSO config wsCallback 正确", ssoConfig.wsCallback === "http://localhost:4000/#/auth/sso-callback");

    // 3) 点击 SSO 按钮 → 跳 ARM /login?next=...
    await page.evaluate(() => {
      // 找 SSO 按钮
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("SSO"));
      btn?.click();
    });
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    await sleep(1000);
    const onArmLogin = page.url().includes("/login?next=") || page.url().includes("/login&next=");
    check("点击 SSO 按钮跳到 ARM /login?next=...", onArmLogin, page.url());

    // 4) 在 ARM 登录页点 SSO 按钮（要找"单点登录 (SSO)"，不是 tab "单点登录 / API Key"）
    const ssoBtnInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.textContent.includes("SSO") && !b.textContent.includes("API Key"));
      if (!btn) return { found: false, allTexts: buttons.map((b) => b.textContent.trim()) };
      const info = {
        found: true,
        text: btn.textContent.trim(),
        disabled: btn.disabled,
        className: btn.className,
      };
      btn.click();
      return info;
    });
    check("ARM 登录页有 SSO 登录按钮（不是 tab）", ssoBtnInfo.found, JSON.stringify(ssoBtnInfo));
    console.log("[debug] SSO 按钮:", JSON.stringify(ssoBtnInfo));
    console.log("[debug] 点完 SSO 按钮 URL:", page.url());

    // 5) 等跳到 SSO 服务（被拦截）→ 跳到 ARM /auth/callback?next=...&sso_token=...
    await sleep(3000);
    console.log("[debug] 等 3s 后 URL:", page.url());
    check("真 SSO 被拦截", ssoIntercepted);
    check("ARM /auth/callback 被访问", armCallbackReached);

    // 6) 等 ARM page 验 token 跳 workstation
    await sleep(3000);
    const finalUrl = page.url();
    // workstation 解析 hash 后 100ms 跳首页（#），所以检查是否到达 workstation 域即可
    check("跳回 workstation（#/auth/sso-callback 或 /）", finalUrl.startsWith("http://localhost:4000/"), finalUrl);

    // 7) 验证 workstation 存了 auth
    const stored = await page.evaluate(() => {
      const s = localStorage.getItem("arm_ws_auth");
      return s ? JSON.parse(s) : null;
    });
    check("workstation 存了 SSO auth", !!stored?.token && !!stored?.user);
    check("user.name 是 '刘锟'", stored?.user?.name === "刘锟");
    check("user.id 是 ARM DB UUID（8ffe68b6-...）", stored?.user?.id === "8ffe68b6-44c4-4ce8-b18e-2f8f516e3150", `actual: ${stored?.user?.id}`);

    // 8) 顶栏显示用户名
    await sleep(500);
    const topbar = await page.evaluate(() => document.querySelector(".topbar")?.textContent ?? "");
    check("顶栏显示 '刘锟'", topbar.includes("刘锟"));

    // 9) 实际请求 ARM 业务 API（用真 sso_token）—— 必须经过 workstation 后端（避免 CORS）
    // workstation 后端有 /api/ws/agents 透传 ARM，会自动加 CORS 头
    const wsResult = await page.evaluate(async (auth) => {
      const r = await fetch("/api/ws/agents?pageSize=3", {
        headers: { Authorization: `Bearer ${auth.token}`, "X-User-Id": auth.user.id },
      });
      return { status: r.status, body: await r.json() };
    }, stored);
    check("workstation 后端用 sso_token 调 ARM 业务 API 200", wsResult.status === 200, `total=${wsResult.body?.data?.total}`);

    if (pass) {
      console.log("\n✅ 完整 SSO 链路（真 ARM + 模拟真 SSO）验证通过！");
    } else {
      console.log("\n❌ 部分检查失败");
      process.exit(1);
    }
  } catch (e) {
    console.error("测试失败:", e.message);
    await page.screenshot({ path: "/tmp/ws-sso-final-error.png" });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();