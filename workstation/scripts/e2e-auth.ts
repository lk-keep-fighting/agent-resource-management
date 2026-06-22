/**
 * E2E 验证鉴权 + 数据隔离
 *
 * 1. 未登录 → 跳 /login
 * 2. 登录 Alice → 进入首页
 * 3. Alice 创建 WS → userId=user-alice
 * 4. 登出 → 跳回 /login
 * 5. 登录 Bob → 看不到 Alice 的 WS
 * 6. 顶栏显示用户名 + 登出按钮
 */
import puppeteer from "puppeteer-core";

const url = "http://localhost:4000";
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
    // 1) 未登录访问 / 应跳 /login
    await page.goto(url, { waitUntil: "networkidle0" });
    await sleep(500);
    const path1 = await page.evaluate(() => location.hash);
    check("未登录自动跳 /login", path1 === "#/login", `path=${path1}`);

    // 2) 登录页有 API Key 输入
    const hasInput = await page.evaluate(() => !!document.getElementById("login-key"));
    check("登录页有 API Key 输入框", hasInput);

    // 3) 登录 Alice
    await page.type("#login-key", "arm_alpha_2026");
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "登录")?.click();
    });
    await sleep(1000);
    const afterLogin = await page.evaluate(() => ({
      hash: location.hash,
      topbar: document.querySelector(".topbar")?.textContent,
    }));
    check("登录后跳回首页", afterLogin.hash === "#/" || afterLogin.hash === "", `hash=${afterLogin.hash}`);
    check("顶栏显示用户名 Alice", afterLogin.topbar?.includes("Alice"));
    check("顶栏有'登出'按钮", afterLogin.topbar?.includes("登出"));

    // 4) Alice 创建 WS
    await page.evaluate(() => (location.hash = "#/agents"));
    await sleep(500);
    // 找一个 agent
    const agentCard = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".card"));
      for (const c of cards) {
        if (c.textContent.includes("Bug 分类专员")) { c.click(); return true; }
      }
      return false;
    });
    if (!agentCard) throw new Error("找不到 Bug 分类专员");
    await sleep(500);
    // 新建
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("a")).find((a) => a.textContent.includes("新建工作空间"))?.click();
    });
    await sleep(500);
    await page.evaluate(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("下一步"))?.click());
    await sleep(200);
    await page.type("input", "Alice 的 WS");
    await page.evaluate(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("下一步"))?.click());
    await sleep(200);
    await page.evaluate(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("创建工作空间"))?.click());
    await sleep(1500);
    // 不需要真的进 chat，看 home 是否出现新 WS
    await page.evaluate(() => (location.hash = "#/"));
    await sleep(500);
    const homeText = await page.evaluate(() => document.querySelector(".container")?.textContent ?? "");
    check("Alice 首页显示 'Alice 的 WS'", homeText.includes("Alice 的 WS"));

    // 5) 登出
    await page.evaluate(() => {
      const top = document.querySelector(".topbar");
      const link = Array.from(top?.querySelectorAll("a") ?? []).find((a) => a.textContent.trim() === "登出");
      link?.click();
    });
    await sleep(500);
    const path2 = await page.evaluate(() => location.hash);
    check("登出跳回 /login", path2 === "#/login", `path=${path2}`);

    // 6) 登录 Bob
    await page.type("#login-key", "arm_beta_2026");
    await page.evaluate(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "登录")?.click());
    await sleep(1000);
    await page.evaluate(() => (location.hash = "#/"));
    await sleep(500);
    const bobHome = await page.evaluate(() => document.querySelector(".container")?.textContent ?? "");
    check("Bob 首页显示用户名 Bob", (await page.evaluate(() => document.querySelector(".topbar")?.textContent))?.includes("Bob"));
    check("Bob 看不到 Alice 的 WS（数据隔离）", !bobHome.includes("Alice 的 WS"));

    if (pass) {
      console.log("\n✅ 鉴权 + 数据隔离验证全部通过");
    } else {
      console.log("\n❌ 部分检查失败");
    }
  } catch (e) {
    console.error("测试失败:", e.message);
    await page.screenshot({ path: "/tmp/ws-auth-error.png" });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();