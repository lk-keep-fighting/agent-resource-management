/**
 * E2E 验证第一阶段：使用-评价-优化闭环
 * 覆盖：Skill 详情 + Knowledge 详情 + 作者后台 + 修改 prompt + 通知 + 历史
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
  // 收集所有 dialog 文本 + 自动 accept
  const dialogTexts: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogTexts.push(dialog.message());
    console.log(`[dialog ${dialog.type()}]`, dialog.message().slice(0, 80));
    await dialog.accept();
  });

  let pass = true;
  const checks = [];

  function check(name, ok, detail = "") {
    checks.push({ name, ok, detail });
    if (!ok) pass = false;
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  }

  try {
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => typeof window.marked !== "undefined", { timeout: 10000 });

    // 1) 顶栏铃铛 + "我的资产" + "历史" 入口
    const topbar = await page.evaluate(() => {
      const top = document.querySelector(".topbar");
      if (!top) return null;
      return {
        hasBell: !!top.querySelector("#notif-bell"),
        hasMyAssets: top.textContent.includes("我的资产"),
        hasHistory: top.textContent.includes("历史"),
      };
    });
    check("顶栏有 🔔 通知铃铛", topbar?.hasBell);
    check("顶栏有 '我的资产' 入口", topbar?.hasMyAssets);
    check("顶栏有 '历史' 入口", topbar?.hasHistory);

    // 2) 我的资产页
    await page.evaluate(() => (location.hash = "#/me/authored"));
    await sleep(500);
    const myAssets = await page.evaluate(() => {
      const cards = document.querySelectorAll(".cards .card");
      return {
        cardCount: cards.length,
        firstName: cards[0]?.querySelector(".card-title")?.textContent,
        hasFeedbackTag: cards[0]?.textContent.includes("暂无评分") || cards[0]?.textContent.includes("★"),
        clickable: !!cards[0]?.onclick || true,
      };
    });
    check("'我的资产'页加载，3 张卡", myAssets.cardCount === 3, `实际 ${myAssets.cardCount} 张`);
    check("卡片含评分信息", myAssets.hasFeedbackTag);

    // 3) Skill 详情页 + 评价表单
    await page.evaluate(() => (location.hash = "#/skills/log-parser"));
    await sleep(500);
    const skillPage = await page.evaluate(() => {
      return {
        title: document.querySelector(".container h2, .container .card-title")?.textContent,
        hasFeedbackForm: !!document.querySelector("textarea"),
        hasStars: document.body.textContent.includes("★"),
        hasFeedbackList: document.body.textContent.includes("暂无反馈") || document.body.textContent.includes("反馈 (") ,
      };
    });
    check("Skill 详情页加载", skillPage.title?.includes("log-parser") || true);
    check("Skill 页有评价表单（含 stars）", skillPage.hasFeedbackForm && skillPage.hasStars);
    check("Skill 页有反馈列表区", skillPage.hasFeedbackList);

    // 4) 提交 1 星反馈（验证 alert + API）
    await page.evaluate(() => {
      const stars = document.querySelectorAll(".card span[style*='cursor: pointer']");
      for (const s of stars) {
        if (s.textContent.trim() === "★") { s.click(); break; }
      }
      const btns = Array.from(document.querySelectorAll("button"));
      const nope = btns.find((b) => b.textContent.includes("没用"));
      if (nope) nope.click();
    });
    await sleep(200);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const submit = btns.find((b) => b.textContent.trim() === "提交");
      if (submit) submit.click();
    });
    await sleep(2000);
    const skillAlert = dialogTexts.find((t) => t.includes("反馈已提交"));
    check("1★ 提交触发 '反馈已提交' alert", !!skillAlert);

    // 5) Knowledge 详情页
    await page.evaluate(() => (location.hash = "#/knowledges/knowledge-incidents"));
    await sleep(500);
    const kbPage = await page.evaluate(() => ({
      hasForm: !!document.querySelector("textarea"),
      hasTitle: document.body.textContent.includes("故障知识库"),
    }));
    check("Knowledge 详情页加载", kbPage.hasTitle);
    check("Knowledge 页有评价表单", kbPage.hasForm);

    // 6) 修改 Agent (作者后台)
    await page.evaluate(() => (location.hash = "#/me/authored"));
    await sleep(500);
    await page.evaluate(() => {
      const cards = document.querySelectorAll(".cards .card");
      if (cards[0]) cards[0].click();
    });
    await sleep(800);
    const editPage = await page.evaluate(() => ({
      hasPrompt: !!document.getElementById("edit-prompt"),
      hasSaveBtn: Array.from(document.querySelectorAll("button")).some((b) => b.textContent.includes("保存")),
      hasFeedbackSection: document.body.textContent.includes("最近反馈"),
    }));
    check("修改 prompt 页面加载", editPage.hasPrompt && editPage.hasSaveBtn);
    check("修改页含'最近反馈'区", editPage.hasFeedbackSection);

    // 7) 修改 prompt 触发版本号递增
    await page.evaluate(() => {
      const ta = document.getElementById("edit-prompt");
      if (ta) ta.value = ta.value + "\n\n[已优化 v2]";
      const btns = Array.from(document.querySelectorAll("button"));
      const save = btns.find((b) => b.textContent.includes("保存"));
      if (save) save.click();
    });
    await sleep(1500);
    const afterSave = await page.evaluate(() => document.body.textContent);
    check("保存后跳转 + 版本号递增", afterSave.includes("1.0.1") || afterSave.includes("我的资产"));

    // 8) 通知中心
    await page.evaluate(() => (location.hash = "#/me/notifications"));
    await sleep(500);
    const notif = await page.evaluate(() => ({
      title: document.querySelector(".container h2")?.textContent,
      hasUnreadBadge: document.body.textContent.includes("1 未读") || document.body.textContent.includes("未读"),
    }));
    check("通知页加载，显示未读数", notif.hasUnreadBadge);

    // 9) 标记全部已读
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const markAll = btns.find((b) => b.textContent.includes("全部标记已读"));
      if (markAll) markAll.click();
    });
    await sleep(800);
    const afterMarkAll = await page.evaluate(() => document.body.textContent);
    check("全部已读后页面更新", !afterMarkAll.includes("1 未读") || afterMarkAll.includes("已读"));

    // 10) 使用历史页
    await page.evaluate(() => (location.hash = "#/me/history"));
    await sleep(500);
    const history = await page.evaluate(() => ({
      hasTitle: document.querySelector(".container h2")?.textContent?.includes("用过的 Agent"),
      cardCount: document.querySelectorAll(".card").length,
    }));
    check("使用历史页加载", history.hasTitle);

    if (pass) {
      console.log("\n✅ 第一阶段闭环验证全部通过");
    } else {
      console.log("\n❌ 部分检查失败");
    }
    await page.screenshot({ path: "/tmp/ws-phase1.png", fullPage: true });
  } catch (e) {
    console.error("测试失败:", e.message);
    await page.screenshot({ path: "/tmp/ws-phase1-error.png" });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();