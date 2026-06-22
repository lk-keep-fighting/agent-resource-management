/**
 * E2E 验证 SSO 集成（Mock SSO 服务）
 *
 * 流程：
 * 1. 访问 login 页有 SSO 按钮
 * 2. 点 SSO 按钮调 /api/ws/config/sso 拿 loginUrl
 * 3. mock-arm 在 /mock-sso-callback 路由：拿 token，模拟 ARM callback 跳回 workstation
 * 4. workstation 解析 hash 存 localStorage，跳首页
 * 5. 顶栏显示 SSO 用户名
 */
import puppeteer from "puppeteer-core";

const url = "http://localhost:4000";
const ARM_URL = "http://localhost:3999";
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
  page.on("dialog", async (d) => { await d.accept(); });

  let pass = true;
  const checks = [];
  function check(name, ok, detail = "") {
    checks.push({ name, ok });
    if (!ok) pass = false;
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  }

  try {
    // 拦截 SSO 跳转：把真 SSO URL 改成 mock-arm 路径
    await page.setRequestInterception(true);
    const realSSOUrl = "https://sso.agent-platform.dev.aimstek.cn";
    const mockSSOUrl = `${ARM_URL}/mock-sso`;
    page.on("request", (req) => {
      const u = req.url();
      if (u.startsWith(realSSOUrl)) {
        const modified = u.replace(realSSOUrl, mockSSOUrl);
        console.log(`[mock-sso] 重定向: ${u} → ${modified}`);
        req.continue({ url: modified });
      } else {
        req.continue();
      }
    });

    // 1) 登录页
    await page.goto(url, { waitUntil: "networkidle0" });
    await sleep(500);
    const hasSSO = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).some((b) => b.textContent.includes("SSO"))
    );
    check("登录页有 SSO 登录按钮", hasSSO);

    // 2) 拿 SSO config
    const ssoConfig = await page.evaluate(async () => {
      const r = await fetch("/api/ws/config/sso");
      const j = await r.json();
      return j.data;
    });
    check("SSO config 返回 loginUrl", !!ssoConfig.loginUrl, ssoConfig.loginUrl?.slice(0, 80));
    check("SSO config 含 wsCallback", ssoConfig.wsCallback?.includes("/auth/sso-callback"));
    // URL 中的 "next=" 可能是 URL 编码的 %3Fnext%3D
    const hasNext = ssoConfig.loginUrl?.includes("next=") || ssoConfig.loginUrl?.includes("next%3D");
    check("SSO config 含 next 参数（ARM 跳回用）", hasNext, ssoConfig.loginUrl);

    // 3) mock-arm 路由：拦截 /mock-sso 后直接 302 跳回 workstation
    // 我们通过 setRequestInterception 改了 URL 到 /mock-sso
    // mock-arm 还没有这个端点，先用 page.evaluate 直接构造 URL 测试 callback
    const ssoPayload = {
      token: "sso-test-token-abc123",
      user: { id: "user-sso-test", name: "SSO Test User", email: "sso@test.com", role: "USER" },
    };
    // 用 ? 而不是 #：URL 中 ? 在 fragment 之前是允许的。 但浏览器看到第一个 # 后所有都是 fragment。
    // 所以用 #sso= 在 hash 内
    const hash = `#/auth/sso-callback#sso=${encodeURIComponent(JSON.stringify(ssoPayload))}`;

    // 4) 跳到 callback（在自动跳转前抓内容）
    await page.goto(`${url}/${hash}`, { waitUntil: "domcontentloaded" });
    // 立即抓取（跳转前）
    const onCallback = await page.evaluate(() => ({
      hash: location.hash,
      bodyText: document.body.textContent.slice(0, 300),
    }));
    console.log("callback 页内容:", onCallback.bodyText);
    check("SSO callback 页面显示成功", onCallback.bodyText.includes("SSO 登录成功") || onCallback.bodyText.includes("欢迎"));

    // 5) localStorage 应有 auth
    const auth = await page.evaluate(() => {
      const s = localStorage.getItem("arm_ws_auth");
      return s ? JSON.parse(s) : null;
    });
    check("localStorage 存了 SSO 登录信息", auth?.token === "sso-test-token-abc123");
    check("localStorage user.name = 'SSO Test User'", auth?.user?.name === "SSO Test User");

    // 6) 100ms 后应自动跳首页
    await sleep(500);
    const path = await page.evaluate(() => location.hash);
    check("SSO callback 100ms 后跳回首页", path === "#/" || path === "");

    // 7) 顶栏显示 SSO 用户
    const topbar = await page.evaluate(() => document.querySelector(".topbar")?.textContent ?? "");
    check("顶栏显示 'SSO Test User'", topbar.includes("SSO Test User"));

    if (pass) {
      console.log("\n✅ SSO callback 验证全部通过");
    } else {
      console.log("\n❌ 部分检查失败");
      process.exit(1);
    }
  } catch (e) {
    console.error("测试失败:", e.message);
    await page.screenshot({ path: "/tmp/ws-sso-error.png" });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();