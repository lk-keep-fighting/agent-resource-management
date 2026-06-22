/**
 * E2E 视觉对比：测量消息气泡的实际高度
 *
 * 验证目标：信息密度提升（同内容应占更少像素）
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

  try {
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => typeof window.marked !== "undefined", { timeout: 10000 });

    // 直接注入一个完整的对话场景（user + assistant 含 tool + 后续）
    await page.evaluate(() => {
      const box = document.createElement("div");
      box.className = "chat-messages";
      box.style.height = "500px";
      box.style.overflow = "auto";
      box.style.background = "#fff";
      box.style.padding = "12px 16px";

      box.innerHTML = `
        <div class="msg user">
          <div class="content"><div class="md">
            <p>请帮我用 bash 排查当前目录有什么文件，然后看看最近的错误日志。</p>
          </div></div>
        </div>

        <div class="msg assistant">
          <div class="role">assistant</div>
          <div class="tool-list">
            <div class="tool-summary">
              <div class="ts-head">
                <span class="ts-text">🔧  Called 2 tools · 0.4s</span>
                <span class="ts-chev">▸</span>
              </div>
              <div class="ts-list" style="display:none">
                <div class="ts-row ts-done"><span class="ts-row-icon">✅</span><span class="ts-row-name">bash</span><span class="ts-row-dur muted">0.3s</span></div>
                <div class="ts-row ts-done"><span class="ts-row-icon">✅</span><span class="ts-row-name">read</span><span class="ts-row-dur muted">0.1s</span></div>
              </div>
            </div>
          </div>
          <div class="content"><div class="md">
            <h3>排查结果</h3>
            <p>当前目录有 <code>3</code> 个文件，没有发现错误日志。</p>
            <h4>建议</h4>
            <ol>
              <li>查看 <code>data/</code> 目录详情</li>
              <li>检查 <code>package.json</code></li>
              <li>运行 <code>bun run dev</code> 重启服务</li>
            </ol>
            <blockquote>注意：建议先备份再操作</blockquote>
            <p>需要我继续吗？</p>
          </div></div>
        </div>

        <div class="msg user">
          <div class="content"><div class="md">
            <p>好，帮我重启服务</p>
          </div></div>
        </div>

        <div class="msg assistant">
          <div class="role">assistant</div>
          <div class="tool-list">
            <div class="tool-summary">
              <div class="ts-head">
                <span class="ts-text">🔧  Called 1 tool · 2.1s</span>
                <span class="ts-chev">▸</span>
              </div>
              <div class="ts-list" style="display:none"></div>
            </div>
          </div>
          <div class="content"><div class="md">
            <p>已重启。</p>
          </div></div>
        </div>
      `;
      document.body.appendChild(box);
    });

    // 测量总高度 + 各消息高度
    const measure = await page.evaluate(() => {
      const box = document.querySelector(".chat-messages");
      const totalH = box.scrollHeight;
      const msgs = Array.from(box.querySelectorAll(".msg"));
      return {
        totalHeight: totalH,
        messages: msgs.map((m, i) => {
          const r = m.getBoundingClientRect();
          return {
            index: i,
            role: m.classList.contains("user") ? "user" : "assistant",
            height: Math.round(r.height),
            contentText: m.querySelector(".content")?.textContent?.slice(0, 50),
          };
        }),
      };
    });
    console.log("=== 测量结果 ===");
    console.log(`总高度: ${measure.totalHeight}px`);
    for (const m of measure.messages) {
      console.log(`  [${m.index}] ${m.role.padEnd(10)} ${m.height}px - "${m.contentText}..."`);
    }

    await page.screenshot({ path: "/tmp/ws-compact.png", fullPage: true });

    // 关键指标
    let pass = true;
    // 紧凑后整体高度应该 < 600px（4 条消息）
    if (measure.totalHeight > 700) {
      console.error(`❌ 总高度 ${measure.totalHeight}px 偏大（目标 < 700）`);
      pass = false;
    } else {
      console.log(`✅ 总高度 ${measure.totalHeight}px 紧凑`);
    }
    // 单条 user 消息应该 < 80px
    const userMsgs = measure.messages.filter((m) => m.role === "user");
    for (const m of userMsgs) {
      if (m.height > 80) {
        console.error(`❌ user 消息 ${m.height}px 偏大`);
        pass = false;
      }
    }
    // 验证 role 标签 display:none
    const roleDisplay = await page.evaluate(() => {
      const role = document.querySelector(".msg .role");
      return getComputedStyle(role).display;
    });
    console.log(`role 标签 display: ${roleDisplay}`);
    if (roleDisplay !== "none") {
      console.error("❌ role 标签应该 display:none");
      pass = false;
    } else {
      console.log("✅ role 标签已隐藏（紧凑化）");
    }
    // 验证 user 右对齐 + max-width
    const userStyles = await page.evaluate(() => {
      const u = document.querySelector(".msg.user");
      return {
        justifyContent: getComputedStyle(u).justifyContent,
        maxWidth: getComputedStyle(u.querySelector(".content")).maxWidth,
      };
    });
    console.log("user 样式:", userStyles);
    if (userStyles.justifyContent !== "flex-end") {
      console.error("❌ user 消息应 flex-end 右对齐");
      pass = false;
    } else {
      console.log("✅ user 消息右对齐");
    }

    if (pass) {
      console.log("\n✅ 紧凑化布局验证通过");
    } else {
      console.log("\n❌ 验证失败");
      process.exit(1);
    }
  } catch (e) {
    console.error("测试失败:", e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();