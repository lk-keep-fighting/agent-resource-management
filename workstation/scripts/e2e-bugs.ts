/**
 * E2E 验证 Bug 1 + Bug 2 修复
 *
 * Bug 1: 新建向导勾选 enableTools 后应真正生效
 *   - 进入新建向导 step 3，勾选 checkbox
 *   - 点"创建工作空间"
 *   - 跳到 chat 页后，Settings 页 checkbox 应该是勾选状态
 *   - /api/v1 验证 DB 里 enableTools=1
 *
 * Bug 2: 重新进入对话页时历史与对话时一致
 *   - 模拟一个 run（含 assistant + tool 消息 + events）
 *   - 进 chat 页加载历史
 *   - 验证 DOM 结构：role + tool-summary + content（而非扁平 msg.tool）
 */
import puppeteer from "puppeteer-core";
import { Database } from "bun:sqlite";

const url = "http://localhost:4000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DB_PATH = "data/workstation.db";

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (err) => console.log("[browser error]", err.message));

  let pass = true;

  try {
    // ============================================
    // Bug 1 验证
    // ============================================
    console.log("\n========== Bug 1: enableTools 新建生效 ==========");
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => typeof window.marked !== "undefined", { timeout: 10000 });

    // 找一个 Agent
    const agentClicked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".card"));
      for (const c of cards) {
        if (c.textContent.includes("Bug 分类专员")) {
          c.click();
          return true;
        }
      }
      return false;
    });
    if (!agentClicked) throw new Error("找不到 Bug 分类专员");
    await sleep(500);

    // 进入新建向导
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("a")).find((a) =>
        a.textContent.includes("新建工作空间"),
      )?.click();
    });
    await sleep(500);
    // step 1 → 下一步
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("下一步"))?.click();
    });
    await sleep(300);
    // step 2 输名称
    await page.type("input", "Bug1 验证");
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("下一步"))?.click();
    });
    await sleep(300);

    // step 3 勾选 enableTools
    await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
    await sleep(200);
    const beforeCheck = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll("label"));
      const toolLabel = labels.find((l) => l.textContent.includes("启用工具"));
      const cb = toolLabel?.querySelector('input[type="checkbox"]');
      return {
        exists: !!cb,
        checkedBefore: cb?.checked,
      };
    });
    console.log("勾选前 checkbox:", beforeCheck);
    if (beforeCheck.checkedBefore) {
      console.error("❌ 初始应该是未勾选");
      pass = false;
    }

    // 关键：让 setAttribute("checked", true) 真正起效（之前的 bug 是 setAttribute 不生效）
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll("label"));
      const toolLabel = labels.find((l) => l.textContent.includes("启用工具"));
      const cb = toolLabel?.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = true;  // 直接设 property 模拟用户点击
    });
    const afterCheck = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll("label"));
      const toolLabel = labels.find((l) => l.textContent.includes("启用工具"));
      const cb = toolLabel?.querySelector('input[type="checkbox"]');
      return cb?.checked;
    });
    console.log("勾选后 checkbox:", afterCheck);
    if (!afterCheck) {
      console.error("❌ 勾选没生效");
      pass = false;
    }

    // 提交
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent.includes("创建工作空间"),
      )?.click();
    });
    await page.waitForFunction(
      () => location.hash.startsWith("#/w/") && location.hash.endsWith("/chat"),
      { timeout: 8000 },
    );
    await sleep(500);

    // 验证 1：DB 里 enableTools=1
    const dbCheck = (() => {
      const db = new Database(DB_PATH, { readonly: true });
      const rows = db.query(`SELECT id, name, enable_tools FROM ws_workspace WHERE name = 'Bug1 验证'`).all();
      db.close();
      return rows;
    })();
    console.log("DB 查询:", dbCheck);
    if (dbCheck.length === 0) {
      console.error("❌ WS 没创建");
      pass = false;
    } else if (dbCheck[0].enable_tools !== 1) {
      console.error(`❌ enable_tools=${dbCheck[0].enable_tools}（应该是 1）`);
      pass = false;
    } else {
      console.log("✅ DB 中 enable_tools=1（已生效）");
    }

    // 验证 2：进 Settings 页 checkbox 应是勾选状态
    const wsId = dbCheck[0]?.id;
    if (wsId) {
      // 通过 hash 跳到 settings
      await page.evaluate((id) => (location.hash = `#/w/${id}/settings`), wsId);
      await sleep(500);
      const settingsState = await page.evaluate(() => {
        const cb = document.getElementById("ws-enable-tools");
        return {
          exists: !!cb,
          checked: cb?.checked,
          domAttrChecked: cb?.getAttribute("checked"),
        };
      });
      console.log("Settings 页 checkbox 状态:", settingsState);
      if (!settingsState.exists) {
        console.error("❌ Settings 没找到 checkbox");
        pass = false;
      } else if (!settingsState.checked) {
        console.error("❌ Settings 页 checkbox 没勾选");
        pass = false;
      } else {
        console.log("✅ Settings 页 checkbox 已勾选（前后一致）");
      }
    }

    // ============================================
    // Bug 2 验证
    // ============================================
    console.log("\n========== Bug 2: 重新进入对话历史一致 ==========");

    // 直接往 DB 写一个 run（含 user + assistant + tool 消息 + tool_call_start/end events）
    const seedRunId = await page.evaluate((wsId) => {
      // 通过 API 注入不行，改为：发个真消息让 Agent 跑（不依赖 LLM 行为）
      // 改为更直接：手工构造 fetch 调我们的 runs API 创建
      return null;
    }, wsId);

    // 改用最简：手工往 SQLite 插入一个 run + messages + events
    const seedResult = (() => {
      const db = new Database(DB_PATH);
      const { v4: uuid } = require("uuid");
      const runId = uuid();
      const now = Date.now();
      const messages = [
        { runId, seq: 1, role: "user", content: "用 bash 排查当前目录", toolCallId: null, toolName: null, createdAt: now },
        { runId, seq: 2, role: "tool", content: "/Users/lk/.../data/workspaces/abc", toolCallId: "tc-1", toolName: "bash", createdAt: now + 1000 },
        { runId, seq: 3, role: "assistant", content: "## 排查结果\n\n当前工作目录在 `data/workspaces/abc`。", toolCallId: null, toolName: null, createdAt: now + 2000 },
      ];
      const events = [
        { runId, seq: 1, type: "tool_call_start", payload: { toolCallId: "tc-1", toolName: "bash", args: { command: "pwd" } }, createdAt: now + 500 },
        { runId, seq: 2, type: "tool_call_end", payload: { toolCallId: "tc-1", toolName: "bash", result: { content: [{ type: "text", text: "/Users/lk/.../data/workspaces/abc" }] }, isError: false }, createdAt: now + 1500 },
      ];

      // 准备 create_run statement
      db.run(
        `INSERT INTO ws_run
         (id, workspace_id, agent_id, agent_version, title, status, system_prompt, tools_snapshot_json, skill_bindings_json, knowledge_bindings_json, duration_ms, ttft_ms, prompt_tokens, completion_tokens, tool_call_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'completed', '', '[]', '[]', '[]', 2000, 800, 100, 200, 1, ?, ?)`,
        runId, wsId, "agent-bug-classifier", "1.0.0", "Bug 1+2 测试", now, now + 2000,
      );
      const stmt = db.prepare(
        `INSERT INTO ws_message (id, run_id, seq, role, content, tool_call_id, tool_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const m of messages) {
        stmt.run(uuid(), m.runId, m.seq, m.role, m.content, m.toolCallId, m.toolName, m.createdAt);
      }
      const stmt2 = db.prepare(
        `INSERT INTO ws_event (id, run_id, seq, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const e of events) {
        stmt2.run(uuid(), e.runId, e.seq, e.type, JSON.stringify(e.payload), e.createdAt);
      }
      db.close();
      return { runId };
    })();
    console.log("注入 run:", seedResult.runId);

    // 跳回 chat 页，触发历史加载
    await page.evaluate((id) => (location.hash = `#/w/${id}/chat`), wsId);
    await sleep(1500);

    // 验证 assistant 节点结构
    const chatStructure = await page.evaluate(() => {
      const box = document.querySelector(".chat-messages");
      if (!box) return { error: "no messages box" };
      const assistant = box.querySelector(".msg.assistant");
      if (!assistant) return { error: "no assistant" };
      const children = Array.from(assistant.children);
      const idx = {
        role: children.findIndex((c) => c.classList.contains("role")),
        toolList: children.findIndex((c) => c.classList.contains("tool-list")),
        content: children.findIndex((c) => c.classList.contains("content")),
      };
      const toolSummary = assistant.querySelector(".tool-summary");
      const contentH2 = assistant.querySelector(".content h2");
      const userMsg = box.querySelector(".msg.user");
      const toolMsgFlat = box.querySelector(".msg.tool");  // 不应该有"扁平 tool 消息"
      return {
        userMsgCount: box.querySelectorAll(".msg.user").length,
        assistantCount: box.querySelectorAll(".msg.assistant").length,
        flatToolMsgCount: toolMsgFlat ? 1 : 0,  // 不应有
        hasToolSummary: !!toolSummary,
        toolSummaryVisible: toolSummary ? getComputedStyle(toolSummary).display !== "none" : false,
        toolSummaryText: toolSummary?.querySelector(".ts-text")?.textContent,
        domOrder: idx,
        contentHasH2: !!contentH2,
        contentText: assistant.querySelector(".content")?.textContent?.slice(0, 100),
      };
    });
    console.log("Chat 页结构:", JSON.stringify(chatStructure, null, 2));

    if (chatStructure.error) {
      console.error("❌", chatStructure.error);
      pass = false;
    } else {
      if (chatStructure.flatToolMsgCount > 0) {
        console.error("❌ 不应有扁平的 .msg.tool（应合并到 assistant 节点的 tool-summary）");
        pass = false;
      } else {
        console.log("✅ 没有扁平 tool 消息（已合并到 tool-summary）");
      }
      if (!chatStructure.hasToolSummary) {
        console.error("❌ assistant 节点缺少 tool-summary");
        pass = false;
      } else {
        console.log("✅ tool-summary 已嵌入 assistant 节点");
        console.log("   摘要文案:", chatStructure.toolSummaryText);
      }
      if (!(chatStructure.domOrder.role < chatStructure.domOrder.toolList &&
            chatStructure.domOrder.toolList < chatStructure.domOrder.content)) {
        console.error("❌ DOM 顺序错误：", chatStructure.domOrder);
        pass = false;
      } else {
        console.log(`✅ DOM 顺序: role(${chatStructure.domOrder.role}) < toolList(${chatStructure.domOrder.toolList}) < content(${chatStructure.domOrder.content})`);
      }
      if (!chatStructure.contentHasH2) {
        console.error("❌ content 缺 markdown 渲染（h2）");
        pass = false;
      } else {
        console.log("✅ content 含 markdown 渲染（h2）");
      }
    }

    await page.screenshot({ path: "/tmp/ws-bug-fixed.png" });

    if (pass) {
      console.log("\n✅ Bug 1 + Bug 2 全部修复并验证通过");
    } else {
      console.log("\n❌ 验证失败");
      process.exit(1);
    }
  } catch (e) {
    console.error("测试失败:", e.message);
    await page.screenshot({ path: "/tmp/ws-bug-error.png" });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();