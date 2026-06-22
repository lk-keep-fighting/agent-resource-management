/**
 * E2E 浏览器测试：验证 markdown 渲染
 *
 * 流程：
 * 1. 打开 http://localhost:4000
 * 2. 进 Agent 详情
 * 3. 新建 Workspace
 * 4. 发"输出 markdown"消息
 * 5. 等回复
 * 6. 检查 .msg.assistant .content 是否含 <h1>/<pre><code> 等 HTML 标签
 */
import puppeteer from "puppeteer-core";

const url = "http://localhost:4000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function waitText(page, selector, text, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await page.$$eval(selector, (els) => els.length);
    if (found > 0) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.on("console", (msg) => console.log(`[browser ${msg.type()}]`, msg.text()));
  page.on("pageerror", (err) => console.log("[browser error]", err.message));

  try {
    // 首页
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.screenshot({ path: "/tmp/ws-home.png" });
    console.log("[1] 首页 loaded");

    // 等 marked 加载
    await page.waitForFunction(() => typeof window.marked !== "undefined", { timeout: 10000 });
    console.log("[2] marked loaded");

    // 找第一个 Agent 卡片（"Bug 分类专员"）并点击
    const cards = await page.$$(".card");
    if (cards.length === 0) throw new Error("没找到 Agent 卡片");
    // 找一个有 "Bug 分类专员" 字样的卡片
    let clicked = false;
    for (const c of cards) {
      const txt = await page.evaluate((el) => el.textContent, c);
      if (txt.includes("Bug 分类专员")) {
        await c.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) throw new Error("没找到 Bug 分类专员卡片");
    await new Promise((r) => setTimeout(r, 800));
    console.log("[3] Agent 详情 loaded");

    // 点 [+ 新建工作空间]
    await page.waitForSelector("a", { timeout: 5000 });
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const target = links.find((a) => a.textContent.includes("新建工作空间"));
      target?.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    console.log("[4] 新建向导 step 1");

    // step 1 → 下一步
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.includes("下一步"),
      );
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // step 2 输入名称
    await page.waitForSelector("input", { timeout: 3000 });
    await page.type("input", "e2e md test");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.includes("下一步"),
      );
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // step 3 勾选 enableTools（不勾也行，纯聊天也能出 markdown）→ 创建
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.includes("创建工作空间"),
      );
      btn?.click();
    });
    console.log("[5] 创建 WS，wait chat page");

    // 等跳转到 /w/.../chat
    await page.waitForFunction(
      () => location.hash.startsWith("#/w/") && location.hash.endsWith("/chat"),
      { timeout: 5000 },
    );
    await new Promise((r) => setTimeout(r, 1000));
    console.log("[6] chat page loaded");

    // 输入消息
    const ta = await page.waitForSelector("#chat-textarea", { timeout: 5000 });
    await ta.type(
      "请用 markdown 回答：列出 3 个排查步骤，并给一个 ```bash``` 代码示例",
    );
    // 发送
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.trim() === "发送",
      );
      btn?.click();
    });
    console.log("[7] 消息已发送");

    // 等 assistant 出现并完成
    const ok = await waitText(page, ".msg.assistant", null, 60000);
    if (!ok) throw new Error("assistant 消息未出现");
    console.log("[8] assistant 消息出现");

    // 等流结束：.msg.assistant .content 不再变化，且含 h1/pre 标签
    const deadline = Date.now() + 60000;
    let html = "";
    let hasH1 = false;
    let hasPre = false;
    let lastChange = Date.now();
    while (Date.now() < deadline) {
      const result = await page.evaluate(() => {
        const el = document.querySelector(".msg.assistant .content");
        if (!el) return null;
        return {
          html: el.innerHTML,
          textLen: el.textContent?.length || 0,
          hasH1: !!el.querySelector("h1, h2, h3"),
          hasPre: !!el.querySelector("pre code"),
        };
      });
      if (result) {
        if (result.html !== html) {
          html = result.html;
          lastChange = Date.now();
          hasH1 = result.hasH1;
          hasPre = result.hasPre;
        }
        // 超过 5s 没变化，认为流结束
        if (Date.now() - lastChange > 5000 && result.textLen > 30) {
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await page.screenshot({ path: "/tmp/ws-chat-md.png" });

    console.log("\n=== 渲染结果 ===");
    console.log("assistant 内容长度:", html.length);
    console.log("含 <h1>/<h2>/<h3>:", hasH1);
    console.log("含 <pre><code>:", hasPre);
    console.log("HTML 前 500 字符:", html.slice(0, 500));

    if (!hasH1) console.warn("⚠️  没渲染出 h1/h2/h3 标题");
    if (!hasPre) console.warn("⚠️  没渲染出 pre code 代码块");

    // 也检查 user 消息（应该含 <li> 或 <pre>）
    const userHtml = await page.evaluate(() => {
      const el = document.querySelector(".msg.user .content");
      return el ? el.innerHTML : null;
    });
    console.log("\nuser 消息 HTML 前 200 字符:", userHtml?.slice(0, 200));

    if (hasH1 && hasPre) {
      console.log("\n✅ Markdown 渲染通过");
    } else {
      console.log("\n❌ Markdown 渲染未完全通过");
      process.exit(1);
    }
  } catch (e) {
    console.error("测试失败:", e.message);
    await page.screenshot({ path: "/tmp/ws-error.png" });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();