/**
 * E2E 验证：workstation 连续对话上下文保留
 *
 * 流程：
 * 1) 创建一个 Agent（有 LLM 工具）
 * 2) 创建一个 Workspace
 * 3) 发送消息 1："请记住我的幸运数字是 42"
 * 4) 发送消息 2："我的幸运数字是什么？"  → 模型应回答 42
 * 5) 发送消息 3："把它加 1 是多少？"  → 模型应回答 43（结合上文 42）
 */
import puppeteer from "puppeteer-core";

const url = "http://localhost:4000";
const ARM_URL = "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

interface SseEvent { event: string; data: any; }

async function postSse(
  path: string,
  body: any,
  authToken: string,
  userId: string,
): Promise<SseEvent[]> {
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      "X-User-Id": userId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const events: SseEvent[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.trim()) continue;
      let evName = "message";
      let evData = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("event: ")) evName = line.slice(7).trim();
        else if (line.startsWith("data: ")) evData += line.slice(6);
      }
      try {
        events.push({ event: evName, data: evData ? JSON.parse(evData) : null });
      } catch { /* ignore parse errors */ }
    }
  }
  return events;
}

function collectAssistantText(events: SseEvent[]): string {
  let text = "";
  for (const e of events) {
    if (e.event === "message.delta" && e.data?.delta) {
      text += e.data.delta;
    } else if (e.event === "message.done" && e.data?.finalMessage?.content) {
      // fallback
    }
  }
  return text;
}

(async () => {
  let pass = true;
  function check(name: string, ok: boolean, detail = "") {
    if (!ok) pass = false;
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  }

  // 准备：拿一个能用的 Agent（用 ARM 的现有 agent，不创建新的避免依赖创建流程）
  const agentsRes = await fetch(`${ARM_URL}/api/v1/agents?pageSize=5`);
  const agentsJson: any = await agentsRes.json();
  const agentList: any[] = agentsJson?.data?.agents ?? [];
  if (agentList.length === 0) {
    console.log("❌ ARM 没 agent，无法测试。请先在 ARM dashboard 创建至少一个 agent。");
    process.exit(1);
  }
  const agentId = agentList[0].id;
  const agentName = agentList[0].name;
  console.log(`使用 ARM agent: ${agentName} (${agentId})`);

  // 准备：拿真 SSO token（用之前测过的，或创建 api key）
  // 用一个能直接调 workstation 的方式：直接拿之前 e2e 用的 sso_token
  // 也可以调 /api/ws/auth/login 拿 dev api key —— 但这里我们要测 SSO
  // 简化：用一个 mock 走通 workstation 鉴权（X-User-Id 信任）
  // 实际需要先 SSO 登录拿 token
  const SSO_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbW5vZTRhMHYwMDAwOWthNDBhOGo0cW45IiwiZmVpc2h1VW5pb25JZCI6Im9uX2M0YTYzZTM1ODdiYTdkZWRjNmIwNGZlM2E0ZjRiMDhhIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3ODIxNDQ2NTcsImV4cCI6MTc4Mjc0OTQ1N30.hxZVw_IG7or2R1maAkDAMHmI9Ydk5nQqMX8yzt2_654";
  const USER_ID = "8ffe68b6-44c4-4ce8-b18e-2f8f516e3150";  // ARM DB user.id

  // 1) 创建 workspace
  const wsRes = await fetch(`${url}/api/ws/workspaces`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SSO_TOKEN}`,
      "X-User-Id": USER_ID,
    },
    body: JSON.stringify({ agentId, name: "对话测试 WS", context: "你正在测试连续对话能力。" }),
  });
  const wsJson: any = await wsRes.json();
  if (!wsJson.ok) {
    console.log("❌ 创建 workspace 失败:", wsJson);
    process.exit(1);
  }
  const workspaceId = wsJson.data.id;
  console.log(`Workspace: ${workspaceId}`);

  // 2) 消息 1：让模型记住一个数字
  console.log("\n--- 消息 1：让模型记住 42 ---");
  const events1 = await postSse(
    `/api/ws/workspaces/${workspaceId}/runs`,
    { message: "请记住我的幸运数字是 42。只回复 '好的，已记住 42' 即可。" },
    SSO_TOKEN, USER_ID,
  );
  const text1 = collectAssistantText(events1);
  console.log("回复 1:", text1);
  check("消息 1: 模型回复", text1.length > 0, text1);

  // 3) 消息 2：问上文的数字
  console.log("\n--- 消息 2：问幸运数字 ---");
  const events2 = await postSse(
    `/api/ws/workspaces/${workspaceId}/runs`,
    { message: "我的幸运数字是什么？只回复数字即可。" },
    SSO_TOKEN, USER_ID,
  );
  const text2 = collectAssistantText(events2);
  console.log("回复 2:", text2);
  check("消息 2: 模型记得幸运数字 42", text2.includes("42"), text2);

  // 4) 消息 3：让它加 1（验证多轮上下文）
  console.log("\n--- 消息 3：加 1 ---");
  const events3 = await postSse(
    `/api/ws/workspaces/${workspaceId}/runs`,
    { message: "把它加 1 是多少？只回复数字即可。" },
    SSO_TOKEN, USER_ID,
  );
  const text3 = collectAssistantText(events3);
  console.log("回复 3:", text3);
  check("消息 3: 模型记得 42 并算出 43", text3.includes("43"), text3);

  // 5) 检查 ws_message 真的存了消息（每个 run 独立存，但总 user+assistant 各 3 条）
  const runId1 = events1.find((e) => e.event === "run.created")?.data?.runId;
  const runId2 = events2.find((e) => e.event === "run.created")?.data?.runId;
  const runId3 = events3.find((e) => e.event === "run.created")?.data?.runId;
  console.log(`三个 run: ${runId1.slice(0, 8)} / ${runId2.slice(0, 8)} / ${runId3.slice(0, 8)}`);

  const msgsRes = await fetch(`${url}/api/ws/workspaces/${workspaceId}/runs`, {
    headers: { Authorization: `Bearer ${SSO_TOKEN}`, "X-User-Id": USER_ID },
  });
  const runsJson: any = await msgsRes.json();
  const runs = runsJson?.data ?? [];
  check(`workspace 存了 3 个 run`, runs.length === 3, `actual: ${runs.length}`);

  // 每个 run 1 个 user + 1 个 assistant
  let totalUser = 0, totalAsst = 0;
  for (const r of runs) {
    const mRes = await fetch(`${url}/api/ws/runs/${r.id}/messages`, {
      headers: { Authorization: `Bearer ${SSO_TOKEN}`, "X-User-Id": USER_ID },
    });
    const mJson: any = await mRes.json();
    const m = mJson?.data ?? [];
    totalUser += m.filter((x: any) => x.role === "user").length;
    totalAsst += m.filter((x: any) => x.role === "assistant").length;
  }
  check(`workspace 总 user 消息 3`, totalUser === 3, `actual: ${totalUser}`);
  check(`workspace 总 assistant 消息 3`, totalAsst === 3, `actual: ${totalAsst}`);

  if (pass) {
    console.log("\n✅ 连续对话上下文验证通过！");
  } else {
    console.log("\n❌ 部分检查失败");
    process.exit(1);
  }
})();
