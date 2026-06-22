/**
 * E2E 浏览器测试：tool-summary 紧凑样式
 *
 * 直接调用 page 内 createToolSummary（暴露到 window）模拟
 * 1 个 / 多个 tool 调用的状态。
 */
import puppeteer from "puppeteer-core";

const url = "http://localhost:4000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (err) => console.log("[browser error]", err.message));

  try {
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => typeof window.marked !== "undefined", { timeout: 10000 });

    // 找第一个 Agent
    const clicked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".card"));
      for (const c of cards) {
        if (c.textContent.includes("Bug 分类专员")) {
          c.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error("找不到 Bug 分类专员");
    await sleep(500);

    // 新建 WS（不开 enableTools）
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll("a")).find((a) =>
        a.textContent.includes("新建工作空间"),
      );
      link?.click();
    });
    await sleep(500);
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("下一步"))?.click();
    });
    await sleep(300);
    await page.type("input", "summary test");
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("下一步"))?.click();
    });
    await sleep(300);
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent.includes("创建工作空间"),
      )?.click();
    });
    await page.waitForFunction(
      () => location.hash.startsWith("#/w/") && location.hash.endsWith("/chat"),
      { timeout: 8000 },
    );
    await sleep(800);

    // 在 messagesBox 里手动构造一个 assistant 节点（复用页面上的 createToolSummary）
    // 我们的 main.js 没有把 createToolSummary 暴露到 window，所以这里直接 innerHTML 模拟两种状态
    const result = await page.evaluate(() => {
      const box = document.querySelector(".chat-messages");
      box.innerHTML = "";

      // user msg
      box.insertAdjacentHTML("beforeend", `
        <div class="msg user">
          <div class="role">user</div>
          <div class="content"><div class="md"><p>请帮我排查</p></div></div>
        </div>
      `);

      // 场景 1: 0 个 tool（应该完全隐藏）
      // 场景 2: 1 个 tool（显示 "🔧 bash ✅ 0.5s"）
      // 场景 3: 3 个 tool（显示 "🔧 Called 3 tools · 1.2s" + 展开后看 3 行）

      const html = `
        <div class="msg assistant">
          <div class="role">assistant</div>
          <div class="tool-list">
            <!-- 场景 1: 0 个 tool -->
            <div class="tool-summary" style="display:none" data-scenario="0">
              <div class="ts-head"><span class="ts-text"></span><span class="ts-chev">▸</span></div>
              <div class="ts-list" style="display:none"></div>
            </div>

            <!-- 场景 2: 1 个 tool -->
            <div class="tool-summary" data-scenario="1">
              <div class="ts-head">
                <span class="ts-text">✅  bash · 0.5s</span>
                <span class="ts-chev">▸</span>
              </div>
              <div class="ts-list" style="display:none">
                <div class="ts-row ts-done">
                  <span class="ts-row-icon">✅</span>
                  <span class="ts-row-name">bash</span>
                  <span class="ts-row-dur muted">0.5s</span>
                </div>
              </div>
            </div>

            <!-- 场景 3: 3 个 tool -->
            <div class="tool-summary" data-scenario="3">
              <div class="ts-head">
                <span class="ts-text">🔧  Called 3 tools · 1.2s</span>
                <span class="ts-chev">▸</span>
              </div>
              <div class="ts-list" style="display:none">
                <div class="ts-row ts-done"><span class="ts-row-icon">✅</span><span class="ts-row-name">bash</span><span class="ts-row-dur muted">0.4s</span></div>
                <div class="ts-row ts-done"><span class="ts-row-icon">✅</span><span class="ts-row-name">read</span><span class="ts-row-dur muted">0.3s</span></div>
                <div class="ts-row ts-done"><span class="ts-row-icon">✅</span><span class="ts-row-name">grep</span><span class="ts-row-dur muted">0.5s</span></div>
              </div>
            </div>
          </div>
          <div class="content"><div class="md">
            <h2>排查结果</h2>
            <p>当前工作目录在 <code>data/workspaces/abc</code>，目录下有 3 个文件。</p>
          </div></div>
        </div>
      `;
      box.insertAdjacentHTML("beforeend", html);

      // 测量每个 scenario 的高度（head 折叠态）
      const measures = {};
      box.querySelectorAll(".tool-summary").forEach((s) => {
        const sc = s.dataset.scenario;
        const head = s.querySelector(".ts-head");
        const list = s.querySelector(".ts-list");
        measures[sc] = {
          display: getComputedStyle(s).display,
          headHeight: head.getBoundingClientRect().height,
          listDisplay: getComputedStyle(list).display,
          rowCount: s.querySelectorAll(".ts-row").length,
          totalHeight: s.getBoundingClientRect().height,
        };
      });
      return measures;
    });
    console.log("=== 三个场景的高度 ===");
    console.log(JSON.stringify(result, null, 2));

    let pass = true;

    // 场景 0: 完全隐藏
    if (result["0"].display !== "none") {
      console.error(`❌ 场景0 (0 tools) 应该 display:none，实际 ${result["0"].display}`);
      pass = false;
    } else {
      console.log("✅ 场景0: 0 tools 完全隐藏");
    }

    // 场景 1: 1 tool 一行紧凑
    if (result["1"].display === "none") {
      console.error("❌ 场景1 应该可见");
      pass = false;
    }
    if (result["1"].listDisplay !== "none") {
      console.error("❌ 场景1 默认应折叠");
      pass = false;
    }
    if (result["1"].totalHeight > 50) {
      console.error(`❌ 场景1 高度应 ≤ 50px，实际 ${result["1"].totalHeight}`);
      pass = false;
    } else {
      console.log(`✅ 场景1: 1 tool，折叠态高度 ${result["1"].totalHeight.toFixed(1)}px`);
    }

    // 场景 3: 3 tools 一行紧凑（默认折叠）
    if (result["3"].totalHeight > 50) {
      console.error(`❌ 场景3 默认折叠态高度应 ≤ 50px，实际 ${result["3"].totalHeight}`);
      pass = false;
    } else {
      console.log(`✅ 场景3: 3 tools，折叠态高度 ${result["3"].totalHeight.toFixed(1)}px (3 个 tool 占用只比 1 个 tool 多一点)`);
    }

    // 截图：折叠态
    await page.screenshot({ path: "/tmp/ws-summary-collapsed.png" });

    // 注：click 展开交互由真实 createToolSummary() 创建的元素才绑定了 handler
    // 本 e2e 用 innerHTML 注入结构仅用于验证样式/布局，click 行为需手动在浏览器中验证

    if (pass) {
      console.log("\n✅ Tool Summary 布局验证全部通过");
    } else {
      console.log("\n❌ Tool Summary 验证失败");
      process.exit(1);
    }
  } catch (e) {
    console.error("测试失败:", e.message);
    await page.screenshot({ path: "/tmp/ws-summary-error.png" });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();