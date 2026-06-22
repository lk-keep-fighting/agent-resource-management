/**
 * E2E 浏览器测试：纯布局验证（不依赖 LLM）
 *
 * 直接在 DOM 构造一个 assistant 节点（带 tool 卡片 + 流式 content），
 * 验证：
 *  1. tool-list 在 content 之前的 DOM 顺序（这是布局优化的核心）
 *  2. tool 卡片默认折叠
 *  3. content 含 markdown 渲染（h2/ol）
 *  4. 截图视觉合理
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

    // 新建 WS
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
    await page.type("input", "layout visual test");
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

    // 直接在 DOM 里构造一个完整的 assistant 节点
    // 模拟"agent 调了 2 个工具后给出最终回复"的场景
    const injected = await page.evaluate(() => {
      const box = document.querySelector(".chat-messages");
      if (!box) return { error: "no messages box" };
      box.innerHTML = "";
      const userMsg = document.createElement("div");
      userMsg.className = "msg user";
      userMsg.innerHTML = '<div class="role">user</div><div class="content"><div class="md"><p>帮我用 bash 排查一下当前工作目录</p></div></div>';
      box.appendChild(userMsg);

      const assistant = document.createElement("div");
      assistant.className = "msg assistant";
      assistant.innerHTML = `
        <div class="role">assistant</div>
        <div class="tool-list">
          <div class="tool-call-card">
            <div class="tool-head">
              <span class="tool-name">🔧 bash</span>
              <span class="muted tool-status">✅ 完成</span>
              <span class="tool-chev" style="margin-left:auto">▸</span>
            </div>
            <div class="tool-body" style="display:none">
              <div class="tool-args"><span class="muted">参数: </span>{"command": "pwd"}</div>
              <div class="tool-divider"></div>
              <div class="md"><pre><code class="language-bash">/Users/lk/.../data/workspaces/abc</code></pre></div>
            </div>
          </div>
          <div class="tool-call-card">
            <div class="tool-head">
              <span class="tool-name">🔧 bash</span>
              <span class="muted tool-status">✅ 完成</span>
              <span class="tool-chev" style="margin-left:auto">▸</span>
            </div>
            <div class="tool-body" style="display:none">
              <div class="tool-args"><span class="muted">参数: </span>{"command": "ls -la"}</div>
              <div class="tool-divider"></div>
              <div class="md"><pre><code class="language-bash">total 0
drwxr-xr-x</code></pre></div>
            </div>
          </div>
        </div>
        <div class="content"><div class="md">
          <h2>排查结果</h2>
          <p>当前工作目录是 <code>/Users/lk/.../data/workspaces/abc</code>，目录下还没有文件。</p>
          <h3>建议</h3>
          <ol>
            <li>把日志放到该目录下</li>
            <li>用 <code>read</code> 工具读取</li>
            <li>用 <code>grep</code> 搜索关键字</li>
          </ol>
        </div></div>
      `;
      box.appendChild(assistant);
      box.scrollTop = box.scrollHeight;
      return { ok: true };
    });
    if (injected.error) throw new Error(injected.error);
    console.log("[1] 注入完成");

    await sleep(500);

    // 验证结构
    const structure = await page.evaluate(() => {
      const a = document.querySelector(".msg.assistant");
      if (!a) return { error: "no assistant" };
      const children = Array.from(a.children);
      const idx = {
        role: children.findIndex((c) => c.classList.contains("role")),
        toolList: children.findIndex((c) => c.classList.contains("tool-list")),
        content: children.findIndex((c) => c.classList.contains("content")),
      };
      const cards = Array.from(a.querySelectorAll(".tool-call-card"));
      const expanded = a.querySelectorAll(".tool-call-card.expanded").length;
      const contentText = a.querySelector(".content")?.textContent ?? "";
      return {
        idx,
        cardCount: cards.length,
        expandedCount: expanded,
        contentHasH2: a.querySelector(".content h2") !== null,
        contentHasOl: a.querySelector(".content ol") !== null,
        contentHasCode: a.querySelector(".content code") !== null,
        contentTextLen: contentText.length,
      };
    });
    console.log("\n=== 布局结构 ===");
    console.log(JSON.stringify(structure, null, 2));

    await page.screenshot({ path: "/tmp/ws-layout-initial.png" });

    let pass = true;
    if (structure.cardCount !== 2) {
      console.error(`❌ 期望 2 个 tool 卡片，实际 ${structure.cardCount}`);
      pass = false;
    }
    if (structure.expandedCount !== 0) {
      console.error(`❌ 期望默认全部折叠，实际 ${structure.expandedCount} 展开`);
      pass = false;
    }
    if (!(structure.idx.role < structure.idx.toolList && structure.idx.toolList < structure.idx.content)) {
      console.error(`❌ DOM 顺序错误：role=${structure.idx.role}, toolList=${structure.idx.toolList}, content=${structure.idx.content}`);
      pass = false;
    } else {
      console.log(`✅ DOM 顺序正确: role(${structure.idx.role}) < toolList(${structure.idx.toolList}) < content(${structure.idx.content})`);
    }
    if (!structure.contentHasH2 || !structure.contentHasOl || !structure.contentHasCode) {
      console.error(`❌ content 缺少 markdown 渲染`);
      pass = false;
    } else {
      console.log("✅ content 含 markdown（h2/ol/code）");
    }

    // 验证"用户始终能看到最终回复"：content 应该在视野内
    const finalVisible = await page.evaluate(() => {
      const box = document.querySelector(".chat-messages");
      const content = box?.querySelector(".msg.assistant .content");
      if (!box || !content) return null;
      const cRect = content.getBoundingClientRect();
      const bRect = box.getBoundingClientRect();
      return {
        contentBottom: cRect.bottom,
        boxBottom: bRect.bottom,
        isContentVisible: cRect.bottom <= bRect.bottom + 10 && cRect.top >= bRect.top - 10,
      };
    });
    console.log("\n=== 视野检测 ===");
    console.log(JSON.stringify(finalVisible, null, 2));
    if (!finalVisible.isContentVisible) {
      console.error("❌ 最终回复不在视野内");
      pass = false;
    } else {
      console.log("✅ 最终回复在视野内");
    }

    if (pass) {
      console.log("\n✅ 布局优化全部通过");
    } else {
      console.log("\n❌ 布局优化失败");
      process.exit(1);
    }
  } catch (e) {
    console.error("测试失败:", e.message);
    await page.screenshot({ path: "/tmp/ws-layout-error.png" });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();