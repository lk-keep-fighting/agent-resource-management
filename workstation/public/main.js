// ─────────── 工具方法 ───────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "style" && typeof v === "object") {
      Object.assign(node.style, v);
    } else if (v === true) {
      // boolean attribute 设为空字符串即表示 true（checked / disabled / selected 等）
      node.setAttribute(k, "");
    } else if (v === false) {
      // false → 移除属性（关键：setAttribute("checked", "false") 仍会显示勾选）
      node.removeAttribute(k);
    } else if (v === undefined || v === null) {
      // skip
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/* ─────────── 鉴权：localStorage token + 全局头 ─────────── */

const AUTH_KEY = "arm_ws_auth";

function getAuth() {
  try {
    const s = localStorage.getItem(AUTH_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
function setAuth(auth) {
  if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  else localStorage.removeItem(AUTH_KEY);
}
function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

function authHeaders() {
  const a = getAuth();
  if (!a?.token) return {};
  return {
    Authorization: `Bearer ${a.token}`,
    "X-User-Id": a.user.id,
  };
}

async function api(path, opts = {}) {
  const res = await fetch(`/api/ws${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    clearAuth();
    navigate("/login");
    throw new Error("未登录");
  }
  const json = await res.json().catch(() => ({ ok: false, msg: "无响应" }));
  if (!json.ok) {
    throw new Error(json.msg || `HTTP ${res.status}`);
  }
  return json.data;
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString();
}

/* ─────────── Markdown 渲染 ─────────── */

let _mdReady = false;
function ensureMarkedConfigured() {
  if (_mdReady) return;
  if (typeof window.marked === "undefined") return; // CDN 还没好
  window.marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
  });
  _mdReady = true;
}

function renderMarkdown(text) {
  if (text == null || text === "") return "";
  if (typeof window.marked === "undefined") {
    // 还没加载完：降级为转义 + pre-wrap
    return `<pre style="white-space:pre-wrap;margin:0;font-family:inherit;">${escapeHtml(text)}</pre>`;
  }
  ensureMarkedConfigured();
  const html = window.marked.parse(text);
  if (typeof window.DOMPurify !== "undefined") {
    return window.DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
  }
  return html;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ─────────── 工具调用摘要组件（顶层，供流式 + 历史加载共用） ─────────── */

function createToolSummary(toolList) {
  const head = el("div", { class: "ts-head" });
  const list = el("div", { class: "ts-list", style: { display: "none" } });
  const container = el("div", { class: "tool-summary", style: { display: "none" } }, [
    head,
    list,
  ]);
  head.addEventListener("click", () => {
    const isOpen = list.style.display !== "none";
    list.style.display = isOpen ? "none" : "block";
    const chev = head.querySelector(".ts-chev");
    if (chev) chev.textContent = isOpen ? "▸" : "▾";
    container.classList.toggle("expanded", !isOpen);
  });
  toolList.appendChild(container);
  return { container, head, list };
}

function formatDuration(ms) {
  if (ms == null) return "0s";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function renderToolSummary(s, tools) {
  const n = tools.length;
  if (n === 0) {
    s.container.style.display = "none";
    return;
  }
  s.container.style.display = "block";

  const allDone = tools.every((t) => t.status === "done" || t.status === "error");
  const runningCount = tools.filter((t) => t.status === "running").length;
  const errorCount = tools.filter((t) => t.status === "error").length;
  const completedTools = tools.filter((t) => t.endTime);
  const totalMs = completedTools.length
    ? Math.max(...completedTools.map((t) => t.endTime)) -
      Math.min(...tools.map((t) => t.startTime))
    : null;

  const headText = (() => {
    if (n === 1) {
      const t = tools[0];
      const dur = t.endTime ? formatDuration(t.endTime - t.startTime) : "执行中";
      const icon = t.status === "error" ? "❌" : t.status === "done" ? "✅" : "⏳";
      return `${icon}  ${t.name} · ${dur}`;
    }
    const icon = errorCount > 0 ? "⚠️" : allDone ? "🔧" : "⏳";
    const label = allDone ? `Called ${n} tools` : `Running ${runningCount}/${n} tools`;
    return `${icon}  ${label} · ${totalMs != null ? formatDuration(totalMs) : "..."}`;
  })();

  s.head.innerHTML = "";
  s.head.appendChild(el("span", { class: "ts-text" }, headText));
  s.head.appendChild(
    el("span", { class: "ts-chev" }, s.list.style.display !== "none" ? "▾" : "▸"),
  );

  s.list.innerHTML = "";
  for (const t of tools) {
    const dur = t.endTime ? formatDuration(t.endTime - t.startTime) : "...";
    const icon = t.status === "error" ? "❌" : t.status === "done" ? "✅" : "⏳";
    const row = el("div", { class: `ts-row ts-${t.status}` }, [
      el("span", { class: "ts-row-icon" }, icon),
      el("span", { class: "ts-row-name" }, t.name),
      el("span", { class: "ts-row-dur muted" }, dur),
    ]);
    row.title = `args: ${JSON.stringify(t.args ?? {}).slice(0, 200)}`;
    row.addEventListener("click", () => showToolDetail(t, s));
    s.list.appendChild(row);
  }
}

function showToolDetail(t, s) {
  const detail = el("div", { class: "ts-detail" });
  detail.appendChild(el("div", { class: "ts-detail-label muted" }, "参数"));
  detail.appendChild(
    el("pre", { class: "ts-detail-pre" }, JSON.stringify(t.args ?? {}, null, 2)),
  );
  if (t.result != null) {
    detail.appendChild(el("div", { class: "ts-detail-label muted" }, "结果"));
    const resultText =
      typeof t.result === "string"
        ? t.result
        : JSON.stringify(t.result, null, 2);
    detail.appendChild(el("div", { class: "md", html: renderMarkdown(resultText) }));
  }
  s.list.innerHTML = "";
  s.list.appendChild(
    el("div", {
      class: "ts-back",
      onclick: () => {
        if (s._tools) renderToolSummary(s, s._tools);
        else s.list.innerHTML = "";
      },
    }, "← 返回列表"),
  );
  s.list.appendChild(detail);
}

/* ─────────── 消息渲染（顶层） ─────────── */

function appendMessage(box, m) {
  const md = m.role === "user" || m.role === "tool" || m.role === "assistant";
  const contentHtml = md
    ? `<div class="md">${renderMarkdown(m.content ?? "")}</div>`
    : escapeHtml(m.content ?? "");
  const node = el("div", { class: `msg ${m.role}` }, [
    el("div", { class: "role" }, m.role),
    el("div", { class: "content", html: contentHtml }),
  ]);
  box.appendChild(node);
  box.scrollTop = box.scrollHeight;
  return node;
}

/**
 * 从 server 返回的 run 详情重建 assistant 节点结构
 * （与对话时一致：role + tool-summary + content）
 *
 * 输入: { messages: [...], events: [...] }
 */
function renderRunHistory(messagesBox, runDetail) {
  const messages = runDetail.messages ?? [];
  const events = runDetail.events ?? [];

  // 从 events 提取 tool 数据（按 toolCallId 索引）
  const toolData = {};
  for (const e of events) {
    if (e.type === "tool_call_start") {
      toolData[e.payload.toolCallId] = {
        name: e.payload.toolName,
        args: e.payload.args ?? {},
        startTime: e.createdAt,
        endTime: null,
        result: null,
        isError: false,
        toolCallId: e.payload.toolCallId,
      };
    } else if (e.type === "tool_call_end") {
      const t = toolData[e.payload.toolCallId] || {
        name: e.payload.toolName,
        args: {},
        startTime: e.createdAt,
        toolCallId: e.payload.toolCallId,
      };
      t.endTime = e.createdAt;
      t.result = e.payload.result;
      t.isError = e.payload.isError;
      toolData[e.payload.toolCallId] = t;
    }
  }

  // 按 message 顺序重建 DOM
  // user: 独立 user 节点
  // assistant: 第一个 assistant 创建 assistant 节点（后续 assistant 追加到 content）
  // tool: 加入 runTools，最后用 renderToolSummary 渲染到 assistant 节点的 tool-summary
  let assistantContainer = null; // { container, head, list, _tools }
  let contentNode = null;
  const runTools = [];

  for (const m of messages) {
    if (m.role === "user") {
      appendMessage(messagesBox, { role: "user", content: m.content });
    } else if (m.role === "assistant") {
      if (!assistantContainer) {
        const toolListNode = el("div", { class: "tool-list" });
        contentNode = el("div", { class: "content", html: "" });
        assistantContainer = el("div", { class: "msg assistant" }, [
          el("div", { class: "role" }, "assistant"),
          toolListNode,
          contentNode,
        ]);
        assistantContainer._toolSummary = createToolSummary(toolListNode);
        assistantContainer._toolSummary._tools = runTools;
        messagesBox.appendChild(assistantContainer);
      }
      // 把 assistant 内容渲染到 content（markdown）
      contentNode.innerHTML = `<div class="md">${renderMarkdown(m.content ?? "")}</div>`;
    } else if (m.role === "tool") {
      // 从 toolData 找完整记录；找不到就用 message 自身的 content（fallback）
      if (m.toolCallId && toolData[m.toolCallId]) {
        const t = toolData[m.toolCallId];
        runTools.push({
          name: t.name,
          args: t.args,
          result: t.result,
          status: t.isError ? "error" : "done",
          startTime: t.startTime,
          endTime: t.endTime,
          toolCallId: t.toolCallId,
        });
      } else if (m.toolName) {
        // 兜底：只知道名字不知道 callId
        runTools.push({
          name: m.toolName,
          args: {},
          result: typeof m.content === "string" ? m.content : null,
          status: "done",
          startTime: m.createdAt,
          endTime: m.createdAt,
          toolCallId: null,
        });
      }
    }
  }

  // 渲染 tool summary
  if (assistantContainer) {
    renderToolSummary(assistantContainer._toolSummary, runTools);
  }
}

/**
 * 前端版 avatar 规范化 —— 与后端 utils/avatar.ts 保持一致。
 * 输入可能是：JSON dicebear 配置 / emoji 字符串 / URL / data URI / undefined
 */
function normalizeAvatar(raw) {
  if (!raw || !raw.trim()) return { kind: "emoji", display: "🤖" };
  if (raw.trimStart().startsWith("{")) return { kind: "emoji", display: "🤖" };
  if (/^(https?:|data:)/i.test(raw)) return { kind: "image", display: raw };
  return { kind: "emoji", display: raw };
}

/**
 * 渲染 Agent 头像。
 * 后端已经预处理 avatar 字段：
 * - avatarKind === "dicebear" | "image" → avatarDisplay 是 data URI / URL，用 <img>
 * - avatarKind === "emoji"              → avatarDisplay 是 emoji 字符串，用文本
 *
 * @param {Agent} a      Agent 对象（含 avatarDisplay / avatarKind / avatar）
 * @param {number} size  像素尺寸
 */
function renderAgentAvatar(a, size = 28) {
  // 后端返回的 agent 已经有 avatarKind / avatarDisplay；ws 对象只有 agentAvatar，需要现场规范化
  let kind = a.avatarKind;
  let display = a.avatarDisplay;
  if (!kind || !display) {
    const n = normalizeAvatar(a.avatar || a.agentAvatar);
    kind = n.kind;
    display = n.display;
  }
  const wrap = el("span", {
    class: "agent-avatar",
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "8px",
      overflow: "hidden",
      background: "#f2f3f5",
      flexShrink: 0,
    },
  });
  if (kind === "dicebear" || kind === "image") {
    wrap.appendChild(el("img", {
      src: display,
      alt: a.name,
      style: { width: "100%", height: "100%", objectFit: "cover" },
    }));
  } else {
    wrap.style.fontSize = `${Math.round(size * 0.55)}px`;
    wrap.appendChild(document.createTextNode(display));
  }
  return wrap;
}

// ─────────── 登录页 ───────────
async function renderLogin() {
  const wrap = el("div", { class: "container", style: { maxWidth: "420px", marginTop: "60px" } }, [
    el("div", { class: "card", style: { padding: "32px" } }, [
      el("div", { style: { textAlign: "center", marginBottom: "20px" } }, [
        el("div", { style: { fontSize: "32px", marginBottom: "8px" } }, "🤖"),
        el("div", { style: { fontSize: "20px", fontWeight: 700 } }, "Agent Workstation"),
        el("div", { class: "muted", style: { fontSize: "13px", marginTop: "4px" } }, "使用 ARM API Key 登录"),
      ]),
      el("div", { class: "form-row" }, [
        el("label", {}, "API Key"),
        el("input", { id: "login-key", type: "password", placeholder: "arm_xxxx_xxxxx", autocomplete: "off" }),
      ]),
      el("div", { class: "form-row" }, [
        el("label", {}, "用户名（仅 mock 模式）"),
        el("input", { id: "login-name", placeholder: "如不填会从 ARM 拉取" }),
      ]),
      el("div", { id: "login-error", class: "muted", style: { color: "#f53f3f", minHeight: "20px", fontSize: "12px", marginBottom: "8px" } }),
      el("button", {
        class: "primary",
        style: { width: "100%" },
        onclick: async () => {
          const key = $("#login-key").value.trim();
          const name = $("#login-name").value.trim();
          if (!key) {
            $("#login-error").textContent = "请输入 API Key";
            return;
          }
          try {
            const res = await fetch("/api/ws/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: key }),
            });
            const j = await res.json();
            if (!j.ok) throw new Error(j.msg);
            const token = j.data.token;
            const user = name ? { ...j.data.user, name } : j.data.user;
            setAuth({ token, user });
            navigate("/");
          } catch (e) {
            $("#login-error").textContent = "登录失败: " + e.message;
          }
        },
      }, "用 API Key 登录"),
      el("div", { style: { display: "flex", alignItems: "center", gap: "8px", margin: "12px 0", color: "#86909c", fontSize: "12px" } }, [
        el("div", { style: { flex: 1, height: "1px", background: "#e5e6eb" } }),
        el("div", {}, "或"),
        el("div", { style: { flex: 1, height: "1px", background: "#e5e6eb" } }),
      ]),
      el("button", {
        style: { width: "100%", padding: "8px", background: "#fff", border: "1px solid #165dff", color: "#165dff", borderRadius: "6px" },
        onclick: async () => {
          try {
            const r = await fetch("/api/ws/config/sso");
            const j = await r.json();
            if (!j.ok) throw new Error("无法获取 SSO 配置");
            window.location.href = j.data.loginUrl;
          } catch (e) {
            $("#login-error").textContent = "SSO 启动失败: " + e.message;
          }
        },
      }, "🔐 用 SSO 登录"),
      el("div", { class: "muted", style: { fontSize: "11px", marginTop: "16px", lineHeight: 1.6 } }, [
        el("div", {}, "🧪 Mock 模式可用的 Key："),
        el("div", { style: { fontFamily: "ui-monospace, monospace", background: "#f7f8fa", padding: "4px 8px", borderRadius: "4px", marginTop: "4px" } },
          "arm_alpha_2026  (Alice) / arm_beta_2026 (Bob)"),
      ]),
    ]),
  ]);
  return wrap;
}

/**
 * SSO callback 路由 —— 从 URL hash 拿 token + user，存 localStorage，跳首页
 */
async function renderSSOCallback() {
  const wrap = el("div", { class: "container", style: { maxWidth: "420px", marginTop: "60px" } });
  // 解析 hash: #sso=<encoded JSON>
  const hash = location.hash;
  const m = hash.match(/#\/auth\/sso-callback\?error=(.+)/);
  if (m) {
    wrap.appendChild(el("div", { class: "card", style: { padding: "32px", textAlign: "center" } }, [
      el("div", { style: { color: "#f53f3f", marginBottom: "8px" } }, "❌ SSO 登录失败"),
      el("div", { class: "muted", style: { fontSize: "12px" } }, decodeURIComponent(m[1])),
      el("div", { style: { marginTop: "16px" } }, [
        el("a", { href: "#/login", style: { color: "#165dff" } }, "返回登录"),
      ]),
    ]));
    return wrap;
  }
  const ssoMatch = hash.match(/#sso=([^&]+)/);
  if (!ssoMatch) {
    // 无 token，可能在等待
    wrap.appendChild(el("div", { class: "card", style: { padding: "32px", textAlign: "center" } }, [
      el("div", {}, "等待 SSO 回调..."),
      el("div", { class: "muted", style: { fontSize: "12px", marginTop: "8px" } }, "如果没有自动跳转，"),
      el("a", { href: "#/login", style: { color: "#165dff" } }, "点这里返回登录"),
    ]));
    return wrap;
  }
  try {
    const payload = JSON.parse(decodeURIComponent(ssoMatch[1]));
    if (!payload.token || !payload.user) throw new Error("payload 缺 token/user");
    setAuth({ token: payload.token, user: payload.user });
    // 清掉 hash 然后跳首页
    setTimeout(() => navigate("/"), 100);
    wrap.appendChild(el("div", { class: "card", style: { padding: "32px", textAlign: "center" } }, [
      el("div", { style: { color: "#00b42a" } }, "✅ SSO 登录成功"),
      el("div", { class: "muted", style: { fontSize: "13px", marginTop: "8px" } }, `欢迎 ${payload.user.name || payload.user.id}`),
    ]));
    return wrap;
  } catch (e) {
    wrap.appendChild(el("div", { class: "card", style: { padding: "32px", textAlign: "center" } }, [
      el("div", { style: { color: "#f53f3f" } }, "❌ SSO 回调解析失败"),
      el("div", { class: "muted", style: { fontSize: "11px", marginTop: "8px" } }, e.message),
    ]));
    return wrap;
  }
}


let CURRENT_USER = null;  // 运行时从 auth 拿
const routes = [
  { path: /^\/login$/, render: renderLogin, public: true },
  { path: /^\/auth\/sso-callback/, render: renderSSOCallback, public: true },
  { path: /^\/$/, render: renderHome, topbar: () => [{ label: "Agent Workstation" }] },
  { path: /^\/agents$/, render: renderAgents },
  { path: /^\/agents\/([^/]+)$/, render: (m) => renderAgentDetail(m[1]) },
  {
    path: /^\/agents\/([^/]+)\/new-workspace$/,
    render: (m) => renderNewWorkspace(m[1]),
  },
  { path: /^\/skills\/([^/]+)$/, render: (m) => renderSkillDetail(m[1]) },
  { path: /^\/knowledges\/([^/]+)$/, render: (m) => renderKnowledgeDetail(m[1]) },
  { path: /^\/me\/authored$/, render: renderAuthored },
  { path: /^\/me\/authored\/([^/]+)$/, render: (m) => renderEditAgent(m[1]) },
  { path: /^\/me\/notifications$/, render: renderNotifications },
  { path: /^\/me\/history$/, render: renderHistory },
  { path: /^\/w\/([^/]+)\/chat$/, render: (m) => renderWorkspaceChat(m[1]) },
  { path: /^\/w\/([^/]+)\/runs$/, render: (m) => renderWorkspaceRuns(m[1]) },
  { path: /^\/w\/([^/]+)\/settings$/, render: (m) => renderWorkspaceSettings(m[1]) },
  { path: /^\/runs\/([^/]+)$/, render: (m) => renderRunDetail(m[1]) },
  {
    path: /^\/contribute\/([^/]+)$/,
    render: (m) => renderContribute(m[1]),
  },
  { path: /^\/settings$/, render: renderSettings },
];

function navigate(path) {
  location.hash = path;
}

function currentPath() {
  const h = location.hash.replace(/^#/, "") || "/";
  return h;
}

async function render() {
  const path = currentPath();
  // 找匹配的路由，提取 public 标记
  const matched = routes.find((r) => path.match(r.path));
  const isPublic = matched?.public === true;

  // 路由保护：未登录 → 跳 /login（public 路由除外）
  const auth = getAuth();
  if (!auth && !isPublic) {
    navigate("/login");
    return;
  }
  // 已登录访问 /login → 回首页
  if (auth && path === "/login") {
    navigate("/");
    return;
  }
  CURRENT_USER = auth?.user ?? null;

  for (const r of routes) {
    const m = path.match(r.path);
    if (m) {
      const app = $("#app");
      app.innerHTML = "";
      const result = await r.render(m);
      app.appendChild(result);
      return;
    }
  }
  $("#app").innerHTML = `<div class="container"><div class="empty">页面不存在: ${path}</div></div>`;
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", render);

// ─────────── 顶栏 ───────────
function renderTopbar(crumbs = []) {
  const auth = getAuth();
  const userName = auth?.user?.name ?? "Guest";
  const wrap = el("div", { class: "topbar" }, [
    el("a", { class: "logo", href: "#/", onclick: (e) => { e.preventDefault(); navigate("/"); } }, "🤖 Agent Workstation"),
    el("div", { class: "crumbs" }, crumbs.map((c, i) => {
      const sep = i > 0 ? [el("span", { class: "muted", style: { margin: "0 8px" } }, "›")] : [];
      return [...sep, c.href ? el("a", { href: "#" + c.href }, c.label) : el("span", {}, c.label)];
    }).flat()),
    el("div", { style: { display: "flex", gap: "16px", alignItems: "center" } }, [
      el("a", { href: "#/me/authored", onclick: (e) => { e.preventDefault(); navigate("/me/authored"); }, style: { color: "#4e5969" } }, "📦 我的资产"),
      el("a", { href: "#/me/history", onclick: (e) => { e.preventDefault(); navigate("/me/history"); }, style: { color: "#4e5969" } }, "🕘 历史"),
      NotificationBell(),
      el("span", { class: "muted", style: { fontSize: "12px" } }, `👤 ${userName}`),
      el("a", {
        href: "#",
        onclick: (e) => { e.preventDefault(); clearAuth(); navigate("/login"); },
        style: { color: "#f53f3f", fontSize: "12px" },
        title: "登出",
      }, "登出"),
    ]),
  ]);
  return wrap;
}

// 通知铃铛：拉取未读数，显示红点
function NotificationBell() {
  const wrap = el("a", {
    href: "#/me/notifications",
    onclick: (e) => { e.preventDefault(); navigate("/me/notifications"); },
    style: { color: "#4e5969", position: "relative", textDecoration: "none" },
    id: "notif-bell",
  }, "🔔");
  fetchUnreadCount().then((n) => {
    if (n > 0) {
      const badge = el("span", {
        style: {
          position: "absolute", top: "-4px", right: "-8px",
          background: "#f53f3f", color: "#fff", borderRadius: "10px",
          padding: "0 5px", fontSize: "10px", fontWeight: 600, minWidth: "16px", textAlign: "center",
        },
      }, n > 99 ? "99+" : String(n));
      wrap.appendChild(badge);
    }
  });
  return wrap;
}

async function fetchUnreadCount() {
  try {
    const r = await fetch(`/api/ws/notifications/unread?userId=${encodeURIComponent(CURRENT_USER?.id ?? "")}`);
    const j = await r.json();
    return j.ok ? (j.data?.count ?? 0) : 0;
  } catch { return 0; }
}

// ─────────── 页面 ───────────

async function renderHome() {
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([{ label: "首页" }]));
  const container = el("div", { class: "container" });

  // 我的工作空间
  const workspaces = await api("/workspaces").catch(() => []);

  container.appendChild(
    el("div", { class: "section" }, [
      el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" } }, [
        el("h2", { style: { margin: 0 } }, `📂 我的工作空间 (${workspaces.length})`),
        el("button", {
          class: "primary",
          onclick: () => openNewWorkspaceModal(null),
          style: { background: "#165dff", color: "#fff", padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer" },
        }, "+ 新建工作空间"),
      ]),
      workspaces.length === 0
        ? el("div", { class: "empty" }, "暂无工作空间，点上方 [新建工作空间] 选个 Agent 开始吧")
        : el("div", { class: "cards" }, workspaces.map(renderWorkspaceCard)),
    ]),
  );

  wrap.appendChild(container);
  return wrap;
}

function renderWorkspaceCard(ws) {
  return el("div", {
    class: "card",
    onclick: () => navigate(`/w/${ws.id}/chat`),
  }, [
    el("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" } }, [
      renderAgentAvatar({ name: ws.agentName, avatar: ws.agentAvatar }, 32),
      el("div", { style: { flex: 1, minWidth: 0 } }, [
        el("div", { class: "card-title", style: { marginBottom: 0 } }, ws.name),
        el("div", { class: "muted", style: { fontSize: "12px" } }, ws.agentName ?? ws.agentId),
      ]),
    ]),
    el("div", { class: "card-sub" }, ws.context || "(无场景描述)"),
    el("div", { class: "card-meta" }, [
      ws.enableTools ? el("span", { class: "tag", style: { background: "#e8f4ff", color: "#165dff" } }, "🔧 工具已启用") : null,
      `${ws.lastActiveAt ? fmtTime(ws.lastActiveAt) : ""}`,
    ]),
  ]);
}

function renderAgentCard(a) {
  // 评分数据归一化：avgRating 可能为 null（无评分）
  const fs = a.feedbackSummary;
  const hasRating = fs && fs.total > 0;
  const avg = hasRating ? fs.avgRating : null;
  return el("div", {
    class: "card agent-card" + (avg != null ? ` rating-${ratingTier(avg)}` : ""),
    onclick: () => navigate(`/agents/${a.id}`),
    "data-agent-id": a.id,
  }, [
    el("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" } }, [
      renderAgentAvatar(a, 32),
      el("div", { class: "card-title", style: { flex: 1, marginBottom: 0 } }, a.name),
    ]),
    el("div", { class: "card-sub" }, a.description),
    el("div", { class: "card-meta" }, [
      el("span", { class: "tag" }, a.status),
      el("span", { class: "tag" }, `v${a.version}`),
      el("span", { class: "tag" }, `${a.workspaceCount ?? 0} 个 WS`),
    ]),
    // 评分底栏：永远渲染，没评分时显示"暂无评分"灰字
    el("div", { class: "card-rating" }, hasRating ? [
      el("span", { class: "rating-stars" }, `★ ${avg}`),
      el("span", { class: "rating-count muted" }, `(${fs.total})`),
      fs.helpfulCount > 0 ? el("span", { class: "rating-good" }, `👍 ${fs.helpfulCount}`) : null,
      fs.unhelpfulCount > 0 ? el("span", { class: "rating-bad" }, `👎 ${fs.unhelpfulCount}`) : null,
    ] : [
      el("span", { class: "muted", style: { fontSize: "12px" } }, "暂无评分"),
    ]),
  ]);
}

/** 根据平均分给卡片左 border 染色：≥4 绿、3-4 黄、<3 红 */
function ratingTier(avg) {
  if (avg >= 4) return "high";
  if (avg >= 3) return "mid";
  return "low";
}

async function renderAgents() {
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([{ label: "首页", href: "/" }, { label: "Agent 员工" }]));
  const container = el("div", { class: "container" });

  const data = await api("/agents?pageSize=100").catch(() => ({ agents: [] }));
  container.appendChild(
    el("div", { class: "section" }, [
      el("h2", {}, `🤖 Agent 员工 (${data.total ?? data.agents.length})`),
      el("div", { class: "cards" }, data.agents.map(renderAgentCard)),
    ]),
  );
  wrap.appendChild(container);
  return wrap;
}

async function renderAgentDetail(agentId) {
  const data = await api(`/agents/${encodeURIComponent(agentId)}`);
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([
    { label: "首页", href: "/" },
    { label: "Agent 员工", href: "/agents" },
    { label: data.name },
  ]));
  const container = el("div", { class: "container" });
  container.appendChild(el("div", { class: "section" }, [
    el("div", { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" } }, [
      renderAgentAvatar(data, 48),
      el("div", {}, [
        el("div", { style: { fontSize: "20px", fontWeight: 700 } }, data.name),
        el("div", { class: "muted" }, data.description),
      ]),
    ]),
    el("div", { style: { marginTop: "8px" } }, [
      el("span", { class: "tag" }, `v${data.version}`),
      el("span", { class: "tag" }, data.status),
      el("span", { class: "tag" }, `绑定 Skill ${(data.skillBindings ?? []).length}`),
      el("span", { class: "tag" }, `绑定 Knowledge ${(data.knowledgeBindings ?? []).length}`),
      data.feedbackSummary?.total > 0
        ? el("span", { class: "tag", style: { background: "#fff7e6", color: "#d46b08" } },
            `★ ${data.feedbackSummary.avgRating ?? "-"} (${data.feedbackSummary.total})`)
        : null,
      data.feedbackSummary?.helpfulCount > 0
        ? el("span", { class: "tag" }, `👍 ${data.feedbackSummary.helpfulCount}`)
        : null,
      data.feedbackSummary?.unhelpfulCount > 0
        ? el("span", { class: "tag" }, `👎 ${data.feedbackSummary.unhelpfulCount}`)
        : null,
    ]),
  ]));

  container.appendChild(el("div", { class: "section" }, [
    el("h2", {}, "已加载资源"),
    (data.skillBindings ?? []).length === 0 && (data.knowledgeBindings ?? []).length === 0
      ? el("div", { class: "muted" }, "（无）")
      : el("div", {}, [
          ...(data.skillBindings ?? []).map((b) => el("div", { class: "tag" }, `Skill: ${b.skillName ?? b.skillId} v${b.version}`)),
          ...(data.knowledgeBindings ?? []).map((b) => el("div", { class: "tag" }, `Knowledge: ${b.knowledgeName ?? b.knowledgeId} v${b.version}`)),
        ]),
  ]));

  // 完整反馈流
  const fbSection = el("div", { class: "section" });
  fbSection.appendChild(el("h2", {}, "💬 反馈流"));
  const fbList = el("div", { class: "fb-list" });
  fbSection.appendChild(fbList);
  container.appendChild(fbSection);
  // 异步加载（不阻塞页面渲染）
  api(`/agents/${encodeURIComponent(agentId)}/feedback?limit=20`)
    .then((fb) => {
      const items = fb?.items ?? [];
      const summary = fb;
      fbList.innerHTML = "";
      // 顶部 summary 大字块
      if (summary?.total > 0) {
        fbList.appendChild(el("div", { class: "fb-summary" }, [
          el("div", { class: "fb-summary-score" }, [
            el("div", { class: `fb-avg tier-${ratingTier(summary.avgRating ?? 0)}` },
              (summary.avgRating ?? 0).toFixed(1)),
            el("div", { class: "fb-stars" },
              "★".repeat(Math.round(summary.avgRating ?? 0)) +
              "☆".repeat(5 - Math.round(summary.avgRating ?? 0))),
          ]),
          el("div", { class: "fb-breakdown" }, [
            el("div", {}, `${summary.total} 条反馈`),
            summary.helpfulCount > 0
              ? el("div", { class: "fb-good" }, `👍 有用 ${summary.helpfulCount}`)
              : null,
            summary.unhelpfulCount > 0
              ? el("div", { class: "fb-bad" }, `👎 没用 ${summary.unhelpfulCount}`)
              : null,
          ]),
        ]));
      }
      if (items.length === 0) {
        fbList.appendChild(el("div", { class: "empty" },
          "还没有反馈 —— 在任意 Run 后点 👍/👎 或评分即可提交"));
      } else {
        for (const it of items) {
          fbList.appendChild(renderAgentFeedbackItem(it));
        }
      }
    })
    .catch((e) => {
      fbList.innerHTML = `<div class="empty">反馈加载失败: ${escapeHtml(e.message)}</div>`;
    });

  container.appendChild(el("div", { class: "section" }, [
    el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" } }, [
      el("h2", { style: { margin: 0 } }, `📂 我的工作空间 (${(data.myWorkspaces ?? []).length})`),
      el("a", {
        href: "#",
        onclick: (e) => { e.preventDefault(); navigate(`/agents/${agentId}/new-workspace`); },
        class: "primary",
        style: { color: "#fff", background: "#165dff", padding: "6px 14px", borderRadius: "6px" },
      }, "+ 新建工作空间"),
    ]),
    (data.myWorkspaces ?? []).length === 0
      ? el("div", { class: "empty" }, "还没有工作空间，点上面按钮创建一个")
      : el("div", { class: "cards" }, data.myWorkspaces.map(renderWorkspaceCard)),
  ]));

  wrap.appendChild(container);
  return wrap;
}

/** 渲染单条 Agent 反馈 */
function renderAgentFeedbackItem(it, opts = {}) {
  const stars = it.rating
    ? "★".repeat(it.rating) + "☆".repeat(5 - it.rating)
    : "—";
  const helpfulIcon = it.isHelpful === true
    ? el("span", { class: "fb-tag fb-tag-good" }, "👍 有用")
    : it.isHelpful === false
    ? el("span", { class: "fb-tag fb-tag-bad" }, "👎 没用")
    : null;
  return el("div", { class: "fb-item" + (opts.critical ? " fb-item-critical" : "") }, [
    el("div", { class: "fb-item-head" }, [
      el("span", { class: "fb-item-stars" }, stars),
      helpfulIcon,
      el("span", { class: "fb-item-time muted" },
        fmtTime(it.createdAt ? new Date(it.createdAt).getTime() : null)),
    ]),
    it.comment
      ? el("div", { class: "fb-item-comment" }, it.comment)
      : el("div", { class: "fb-item-comment muted" }, "(无评论)"),
    (it.tags && it.tags.length > 0)
      ? el("div", { class: "fb-item-tags" }, it.tags.map((t) => el("span", { class: "tag" }, `#${t}`)))
      : null,
  ]);
}

async function renderNewWorkspace(agentId) {
  const data = await api(`/agents/${encodeURIComponent(agentId)}`);
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([
    { label: "首页", href: "/" },
    { label: "Agent", href: "/agents" },
    { label: data.name, href: `/agents/${agentId}` },
    { label: "新建工作空间" },
  ]));
  const container = el("div", { class: "container", style: { maxWidth: "560px" } });

  // 默认值：name = Agent 名；tools = 启用（用户偏好）
  // 高级选项（context + tools）默认折叠，80% 用户只填 name 就能用
  const form = { name: data.name, context: "", enableTools: true };

  const card = el("div", { class: "card", style: { padding: "20px 24px" } });

  // ─── 标题区（Agent 上下文，紧凑一行） ───
  card.appendChild(el("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #f2f3f5" } }, [
    renderAgentAvatar(data, 28),
    el("div", { style: { flex: 1 } }, [
      el("div", { style: { fontWeight: 600 } }, data.name),
      el("div", { class: "muted", style: { fontSize: "12px" } }, `v${data.version} · ${data.description || ""}`),
    ]),
  ]));

  // ─── 必填：名称 ───
  const nameInput = el("input", {
    id: "ws-name",
    value: form.name,
    oninput: (e) => (form.name = e.target.value),
    placeholder: "如：订单系统 Bug分类",
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } },
  });
  card.appendChild(el("div", { class: "form-row" }, [
    el("label", {}, [el("span", {}, "名称 "), el("span", { class: "muted", style: { fontSize: "12px" } }, "（必填）")]),
    nameInput,
  ]));

  // ─── 高级选项：折叠区 ───
  const ctxTextarea = el("textarea", {
    id: "ws-context",
    rows: 5,
    oninput: (e) => (form.context = e.target.value),
    placeholder: "例如：只看订单系统的日志，只输出 P0/P1/P2 三个等级…",
  }, form.context);
  const toolsCheckbox = el("input", {
    type: "checkbox",
    id: "ws-enable-tools",
    checked: form.enableTools,
    onchange: (e) => (form.enableTools = e.target.checked),
    style: { width: "auto" },
  });

  const advBody = el("div", { class: "adv-body" }, [
    el("div", { class: "form-row" }, [
      el("label", {}, [el("span", {}, "场景描述 "), el("span", { class: "muted", style: { fontSize: "12px" } }, "（可选）")]),
      ctxTextarea,
      el("div", { class: "hint" }, "这段文字会和 Agent 的 prompt 一起作为 system prompt。留空则使用 Agent 默认行为。"),
    ]),
    el("div", { class: "form-row" }, [
      el("label", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
        toolsCheckbox,
        el("span", {}, "启用工具（bash / 读写文件 / arm_cli）"),
        el("span", { class: "tag", style: { background: "#fff7e6", color: "#d46b08", marginLeft: "4px" } }, "默认 ✓"),
      ]),
      el("div", { class: "hint" }, [
        "Agent 可在隔离目录 (",
        el("code", {}, `data/workspaces/<id>`),
        ") 中执行命令、读写文件、调用 arm_cli。",
        el("br"),
        "⚠️ 没有沙箱 —— 仅在可信 Agent 上启用。",
      ]),
    ]),
  ]);
  advBody.style.display = "none";  // 默认折叠

  const advChev = el("span", { class: "adv-chev" }, "▸");
  const advToggle = el("div", {
    class: "adv-toggle",
    onclick: () => {
      const open = advBody.style.display !== "none";
      advBody.style.display = open ? "none" : "block";
      advChev.textContent = open ? "▸" : "▾";
    },
  }, [
    advChev,
    el("span", {}, "高级选项（场景描述、工具）"),
    el("span", { class: "muted", style: { fontSize: "12px", marginLeft: "auto" } },
      "已默认：工具 ✓"),
  ]);
  card.appendChild(advToggle);
  card.appendChild(advBody);

  // ─── 底部按钮 ───
  const submitBtn = el("button", { class: "primary", onclick: submit }, "创建工作空间");
  card.appendChild(el("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" } }, [
    el("button", { onclick: () => navigate(`/agents/${agentId}`) }, "取消"),
    submitBtn,
  ]));

  container.appendChild(card);
  wrap.appendChild(container);

  // 提交
  async function submit() {
    const name = form.name.trim();
    if (!name) {
      nameInput.focus();
      return alert("请填写工作空间名称");
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "创建中…";
    try {
      const ws = await api("/workspaces", {
        method: "POST",
        body: {
          agentId,
          name,
          context: form.context.trim(),
          enableTools: form.enableTools,
        },
      });
      navigate(`/w/${ws.id}/chat`);
    } catch (e) {
      alert("创建失败: " + e.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "创建工作空间";
    }
  }

  // 自动 focus 名称框 + 选中全文（用户可直接覆盖默认名）
  setTimeout(() => {
    nameInput.focus();
    nameInput.select();
  }, 0);

  return wrap;
}

/**
 * 新建工作空间 Modal（2 步式）
 *
 * 设计目标：从首页/任何入口一键直达 chat，跳过 4 跳路径
 *  - Step 1: 选 Agent（搜索 + 卡片网格，可一键跳老路径 /agents）
 *  - Step 2: 命名 + 高级选项（默认 name=Agent.name，tools=启用）
 *
 * 单例：复用 document.body 上的 #new-ws-modal 元素
 */
let _newWsModal = null;
function getNewWsModal() {
  if (_newWsModal) return _newWsModal;
  _newWsModal = el("div", {
    class: "new-ws-modal-backdrop",
    id: "new-ws-modal",
    style: { display: "none" },
  });
  document.body.appendChild(_newWsModal);
  return _newWsModal;
}

function closeNewWsModal() {
  if (_newWsModal) _newWsModal.style.display = "none";
  // 清除旧内容，避免下次打开残留
  if (_newWsModal) _newWsModal.innerHTML = "";
}

/**
 * 打开新建 ws modal
 * @param {Array} allAgents  Agent 列表（已 fetch 好的，省一次请求）
 */
function openNewWorkspaceModal(allAgents) {
  const modal = getNewWsModal();
  modal.innerHTML = "";
  modal.style.display = "flex";

  // Step 1: 选 Agent
  let selectedAgent = null;
  let searchKeyword = "";
  let agentsData = allAgents && allAgents.length > 0 ? allAgents : null;

  // 内容容器（每步重新渲染）
  const content = el("div", { class: "new-ws-content" });

  function renderStep1() {
    content.innerHTML = "";
    content.appendChild(el("div", { class: "new-ws-header" }, [
      el("div", { class: "new-ws-title" }, "选择 Agent"),
      el("button", {
        class: "new-ws-close",
        "aria-label": "关闭",
        onclick: closeNewWsModal,
      }, "×"),
    ]));

    // 搜索框
    const searchInput = el("input", {
      type: "search",
      class: "new-ws-search",
      placeholder: "🔍 搜索 Agent（名称 / 描述）",
      value: searchKeyword,
      oninput: (e) => {
        searchKeyword = e.target.value;
        renderGrid();
      },
    });
    content.appendChild(searchInput);

    // 卡片网格容器
    const grid = el("div", { class: "new-ws-grid" });
    content.appendChild(grid);

    function renderGrid() {
      grid.innerHTML = "";
      const kw = searchKeyword.trim().toLowerCase();
      let filtered = agentsData || [];
      if (kw) {
        filtered = filtered.filter((a) =>
          (a.name || "").toLowerCase().includes(kw) ||
          (a.description || "").toLowerCase().includes(kw));
      }
      if (!agentsData) {
        // 还没 fetch 完 → 提示加载中
        grid.appendChild(el("div", { class: "new-ws-loading muted" }, "加载 Agent 列表…"));
        // 主动 fetch
        api("/agents?pageSize=100").then((d) => {
          agentsData = d.agents ?? [];
          renderGrid();
        }).catch(() => {
          grid.appendChild(el("div", { class: "empty" }, "加载 Agent 列表失败"));
        });
        return;
      }
      if (filtered.length === 0) {
        grid.appendChild(el("div", { class: "empty", style: { gridColumn: "1 / -1", padding: "20px" } }, [
          "没有匹配的 Agent",
          el("br"),
          el("a", {
            href: "#/agents",
            onclick: (e) => { e.preventDefault(); closeNewWsModal(); navigate("/agents"); },
            style: { color: "#165dff", fontSize: "13px" },
          }, "去浏览全部 Agent →"),
        ]));
        return;
      }
      for (const a of filtered) {
        grid.appendChild(el("button", {
          class: "new-ws-agent-card",
          onclick: () => {
            selectedAgent = a;
            renderStep2();
          },
        }, [
          renderAgentAvatar(a, 36),
          el("div", { class: "new-ws-agent-name" }, a.name),
          el("div", { class: "new-ws-agent-desc" }, a.description || "（无描述）"),
          el("div", { class: "new-ws-agent-tags" }, [
            el("span", { class: "tag" }, `v${a.version}`),
            a.status ? el("span", { class: "tag" }, a.status) : null,
          ]),
        ]));
      }
    }

    // 底部：兜底跳老路径
    content.appendChild(el("div", { class: "new-ws-footer" }, [
      el("a", {
        href: "#/agents",
        onclick: (e) => { e.preventDefault(); closeNewWsModal(); navigate("/agents"); },
        style: { color: "#86909c", fontSize: "12px" },
      }, "浏览全部 Agent →"),
    ]));

    renderGrid();
    setTimeout(() => searchInput.focus(), 0);
  }

  function renderStep2() {
    content.innerHTML = "";
    const form = { name: selectedAgent.name, context: "", enableTools: true };
    content.appendChild(el("div", { class: "new-ws-header" }, [
      el("div", { class: "new-ws-title" }, "新建工作空间"),
      el("button", {
        class: "new-ws-close",
        "aria-label": "关闭",
        onclick: closeNewWsModal,
      }, "×"),
    ]));

    // 顶部 Agent 上下文
    content.appendChild(el("div", { class: "new-ws-agent-context" }, [
      renderAgentAvatar(selectedAgent, 24),
      el("div", { style: { flex: 1, minWidth: 0 } }, [
        el("div", { style: { fontWeight: 600, fontSize: "13px" } }, selectedAgent.name),
        el("div", { class: "muted", style: { fontSize: "11.5px" } },
          `v${selectedAgent.version} · ${selectedAgent.description || ""}`),
      ]),
      el("button", {
        class: "new-ws-back",
        onclick: renderStep1,
      }, "← 重选"),
    ]));

    // 必填：名称
    const nameInput = el("input", {
      id: "new-ws-name",
      value: form.name,
      oninput: (e) => (form.name = e.target.value),
      placeholder: "如：订单系统 Bug分类",
      onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } },
    });
    content.appendChild(el("div", { class: "form-row" }, [
      el("label", {}, [el("span", {}, "名称 "), el("span", { class: "muted", style: { fontSize: "12px" } }, "（必填）")]),
      nameInput,
    ]));

    // 高级选项折叠
    const ctxTextarea = el("textarea", {
      rows: 4,
      oninput: (e) => (form.context = e.target.value),
      placeholder: "例如：只看订单系统的日志，只输出 P0/P1/P2 三个等级…",
    }, form.context);
    const toolsCheckbox = el("input", {
      type: "checkbox",
      checked: form.enableTools,
      onchange: (e) => (form.enableTools = e.target.checked),
      style: { width: "auto" },
    });
    const advBody = el("div", { style: { display: "none" } }, [
      el("div", { class: "form-row" }, [
        el("label", {}, [el("span", {}, "场景描述 "), el("span", { class: "muted", style: { fontSize: "12px" } }, "（可选）")]),
        ctxTextarea,
        el("div", { class: "hint" }, "这段文字会和 Agent 的 prompt 一起作为 system prompt。"),
      ]),
      el("div", { class: "form-row" }, [
        el("label", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
          toolsCheckbox,
          el("span", {}, "启用工具（bash / 读写文件 / arm_cli）"),
          el("span", { class: "tag", style: { background: "#fff7e6", color: "#d46b08" } }, "默认 ✓"),
        ]),
        el("div", { class: "hint" }, [
          "Agent 可在隔离目录 (",
          el("code", {}, `data/workspaces/<id>`),
          ") 中执行命令、读写文件、调用 arm_cli。",
          el("br"),
          "⚠️ 没有沙箱 —— 仅在可信 Agent 上启用。",
        ]),
      ]),
    ]);
    const advChev = el("span", {}, "▸");
    const advToggle = el("div", {
      class: "adv-toggle",
      onclick: () => {
        const open = advBody.style.display !== "none";
        advBody.style.display = open ? "none" : "block";
        advChev.textContent = open ? "▸" : "▾";
      },
    }, [advChev, el("span", {}, "高级选项（场景描述、工具）")]);
    content.appendChild(advToggle);
    content.appendChild(advBody);

    // 底部按钮
    const submitBtn = el("button", { class: "primary", onclick: submit }, "创建工作空间");
    content.appendChild(el("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" } }, [
      el("button", { onclick: renderStep1 }, "← 上一步"),
      submitBtn,
    ]));

    async function submit() {
      const name = form.name.trim();
      if (!name) {
        nameInput.focus();
        return alert("请填写工作空间名称");
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "创建中…";
      try {
        const ws = await api("/workspaces", {
          method: "POST",
          body: {
            agentId: selectedAgent.id,
            name,
            context: form.context.trim(),
            enableTools: form.enableTools,
          },
        });
        closeNewWsModal();
        navigate(`/w/${ws.id}/chat`);
      } catch (e) {
        alert("创建失败: " + e.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "创建工作空间";
      }
    }

    setTimeout(() => { nameInput.focus(); nameInput.select(); }, 0);
  }

  modal.appendChild(content);

  // 关闭行为：点击背景 / Esc 键
  modal.onclick = (e) => {
    if (e.target === modal) closeNewWsModal();
  };
  const escHandler = (e) => {
    if (e.key === "Escape" && modal.style.display !== "none") {
      closeNewWsModal();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  renderStep1();
}

// ─────────── 对话核心 ───────────
async function renderWorkspaceChat(workspaceId) {
  const ws = await api(`/workspaces/${encodeURIComponent(workspaceId)}`).catch(() => null);
  if (!ws) {
    return el("div", {}, [renderTopbar([{ label: "首页", href: "/" }]),
      el("div", { class: "container" }, el("div", { class: "empty" }, "工作空间不存在"))]);
  }

  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([
    { label: "首页", href: "/" },
    { label: "Agent", href: "/agents" },
    { label: ws.agentName ?? ws.agentId, href: `/agents/${ws.agentId}` },
    { label: ws.name },
  ]));

  // tabs
  const tabs = el("div", { class: "tabs", style: { padding: "0 24px", background: "#fff", borderBottom: "1px solid #e5e6eb" } }, [
    tabLink(`#/w/${workspaceId}/chat`, "Chat", true),
    tabLink(`#/w/${workspaceId}/runs`, "Runs"),
    tabLink(`#/w/${workspaceId}/settings`, "Settings"),
  ]);
  wrap.appendChild(tabs);

  const layout = el("div", { class: "chat-layout", style: { padding: "16px 24px", maxWidth: "none", margin: 0 } });

  // ───── 主对话区 ─────
  const main = el("div", { class: "chat-main" });

  const ctxBox = el("div", { class: "chat-context" }, ws.context || "(无场景描述)");
  main.appendChild(ctxBox);

  const messagesBox = el("div", { class: "chat-messages" });
  main.appendChild(messagesBox);

  // 历史消息加载 —— 重建 assistant 节点结构（role + tool-summary + content）
  // 与对话时的结构保持一致：tool 调用合并到一行摘要，最终回复在底部
  const runs = await api(`/workspaces/${workspaceId}/runs`).catch(() => []);
  if (runs.length > 0) {
    const latest = runs[0];
    const detail = await api(`/runs/${latest.id}`).catch(() => null);
    if (detail) {
      renderRunHistory(messagesBox, detail);
    } else {
      messagesBox.appendChild(el("div", { class: "empty" }, "开始一段新的对话吧 👇"));
    }
  } else {
    messagesBox.appendChild(el("div", { class: "empty" }, "开始一段新的对话吧 👇"));
  }

  const inputArea = el("div", { class: "chat-input" });

  // 文本框 —— 自适应高度（1-6 行）
  const ta = el("textarea", {
    id: "chat-textarea",
    placeholder: "输入消息，Enter 发送，Shift+Enter 换行",
    rows: 1,
  });
  const autoresize = () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };
  ta.addEventListener("input", autoresize);
  inputArea.appendChild(ta);

  // 按钮组（水平排列，紧凑）
  const btnGroup = el("div", { class: "chat-input-btns" });
  inputArea.appendChild(btnGroup);

  // 上下文操作按钮（···）—— 弹出"总结 / 清空"下拉菜单
  const ctxMenuBtn = el("button", {
    class: "ctx-btn",
    title: "更多（总结为知识 / 清空）",
    "aria-label": "更多操作",
    onclick: (e) => {
      e.stopPropagation();
      toggleContextMenu();
    },
  }, "···");
  btnGroup.appendChild(ctxMenuBtn);

  // 发送 / 停止按钮 —— 两态切换：流式时变红色 ⏹ 停止
  const sendBtn = el("button", {
    class: "primary",
    id: "send-btn",
    onclick: send,
  }, "发送");
  btnGroup.appendChild(sendBtn);

  // 隐藏的上下文菜单（绝对定位下拉）
  // 防止重复渲染时累积旧菜单：先清掉 body 里残留的
  const oldMenu = document.getElementById("ctx-menu");
  if (oldMenu) oldMenu.remove();
  const ctxMenu = el("div", { class: "ctx-menu", id: "ctx-menu" }, [
    el("button", {
      class: "ctx-menu-item",
      onclick: () => {
        hideContextMenu();
        handleSummarize();
      },
    }, [
      el("div", { class: "ctx-menu-title" }, "📋 总结为知识"),
      el("div", { class: "ctx-menu-sub" }, "调 LLM 压缩历史 → 上传 ARM → 绑定到 Agent"),
    ]),
    el("button", {
      class: "ctx-menu-item",
      onclick: () => {
        hideContextMenu();
        handleClear();
      },
    }, [
      el("div", { class: "ctx-menu-title" }, "🧹 清空消息"),
      el("div", { class: "ctx-menu-sub" }, "保留 Run 记录，丢弃所有消息"),
    ]),
  ]);
  document.body.appendChild(ctxMenu);  // body 末避免被 overflow:hidden 截掉

  // 点击页面其他位置关闭菜单
  // 同样要做防重复：先把上一次的 listener 注销
  if (window.__ctxMenuDocClick) {
    document.removeEventListener("click", window.__ctxMenuDocClick);
  }
  const docClick = (e) => {
    const m = document.getElementById("ctx-menu");
    const btn = document.querySelector(".ctx-btn");
    if (!m || m.style.display === "none") return;
    if (!m.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
      m.style.display = "none";
    }
  };
  window.__ctxMenuDocClick = docClick;
  document.addEventListener("click", docClick);

  main.appendChild(inputArea);

  const feedbackBar = el("div", { class: "feedback-bar" }, [
    el("span", { class: "muted" }, "对回答评价:"),
    el("button", { onclick: () => rateHelpful(true) }, "👍 有用"),
    el("button", { onclick: () => rateHelpful(false) }, "👎 没用"),
    el("span", { class: "stars", id: "stars" }, [1, 2, 3, 4, 5].map((n) =>
      el("span", { class: "star", "data-n": n, onclick: () => rateStar(n) }, "☆"),
    )),
    el("input", { id: "comment", placeholder: "可选：写两句评论", style: { flex: 1 } }),
    el("button", { onclick: () => submitFeedback() }, "提交反馈"),
    el("button", { onclick: () => { const last = currentRunId; if (last) navigate(`/contribute/${last}`); } }, "📤 沉淀"),
  ]);
  main.appendChild(feedbackBar);

  layout.appendChild(main);

  // ───── 右侧 sidebar ─────
  const side = el("div", { class: "chat-side" });
  side.appendChild(el("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" } }, [
    renderAgentAvatar({ name: ws.agentName, avatar: ws.agentAvatar }, 32),
    el("div", { style: { fontWeight: 600 } }, ws.agentName ?? ws.agentId),
  ]));
  side.appendChild(el("div", { class: "kv" }, [
    el("div", { class: "k" }, "Agent"), el("div", {}, ws.agentName ?? ws.agentId),
    el("div", { class: "k" }, "Version"), el("div", {}, ws.agentVersion ?? "-"),
    el("div", { class: "k" }, "WS"), el("div", {}, ws.name),
  ]));
  side.appendChild(el("div", { class: "divider" }));
  side.appendChild(el("div", { style: { fontWeight: 600, marginBottom: "6px" } }, "📌 上下文"));
  side.appendChild(el("div", { class: "muted", style: { whiteSpace: "pre-wrap" } }, ws.context || "(无)"));
  layout.appendChild(side);

  wrap.appendChild(layout);

  // ───── 行为 ─────
  let currentRunId = runs[0]?.id ?? null;
  let currentRating = 0;
  let currentHelpful = null;
  let isStreaming = false;

  /**
   * 流式状态切换：把"发送"按钮变"⏹ 停止"，把按钮绑到 stopRun()。
   * 文本框禁用，避免在流式过程中又发新消息。
   * 必须等流式结束（run.done / 异常 / 主动 stop）才能复位。
   */
  function setStreaming(s) {
    isStreaming = s;
    if (s) {
      sendBtn.textContent = "⏹ 停止";
      sendBtn.className = "danger";
      sendBtn.onclick = stopRun;
      ta.disabled = true;
      ctxMenuBtn.disabled = true;
      ctxMenuBtn.style.opacity = "0.5";
    } else {
      sendBtn.textContent = "发送";
      sendBtn.className = "primary";
      sendBtn.onclick = send;
      ta.disabled = false;
      ctxMenuBtn.disabled = false;
      ctxMenuBtn.style.opacity = "1";
    }
  }

  /** 主动停止当前 Run —— 调 abort endpoint；后端会调 runner.abort() 终止推理 */
  async function stopRun() {
    if (!currentRunId) {
      setStreaming(false);
      return;
    }
    try {
      sendBtn.disabled = true;
      await api(`/runs/${currentRunId}/abort`, { method: "POST" });
      // 不要在这里 setStreaming(false) —— 后端会发 run.done { status: "aborted" }，
      // 由 handleStreamEvent('run.done') 统一处理复位
    } catch (e) {
      flashTip("❌ 停止失败: " + e.message);
      setStreaming(false);  // 强制复位
    } finally {
      sendBtn.disabled = false;
    }
  }

  // ─────────── 上下文管理下拉菜单 ───────────

  function toggleContextMenu() {
    const m = document.getElementById("ctx-menu");
    const btn = document.querySelector(".ctx-btn");
    if (!m || !btn) return;
    if (m.style.display === "none" || !m.style.display) {
      const rect = btn.getBoundingClientRect();
      // 先临时显示（visibility:hidden 不影响布局）测出实际尺寸
      m.style.position = "fixed";
      m.style.visibility = "hidden";
      m.style.display = "block";
      const menuH = m.offsetHeight;
      const menuW = m.offsetWidth;
      m.style.visibility = "";

      // 智能选方向：优先向下；下方空间不够且上方更多 → 向上
      const MARGIN = 6;
      const spaceBelow = window.innerHeight - rect.bottom - MARGIN;
      const spaceAbove = rect.top - MARGIN;
      const showAbove = spaceBelow < menuH && spaceAbove > spaceBelow;

      // right 对齐按钮右边缘；左侧溢出时左挪
      const wantedRight = window.innerWidth - rect.right;
      const maxRight = window.innerWidth - menuW - 8;
      m.style.right = Math.min(wantedRight, maxRight) + "px";
      m.style.top = (showAbove
        ? rect.top - menuH - MARGIN
        : rect.bottom + MARGIN) + "px";
      m.style.display = "block";
    } else {
      m.style.display = "none";
    }
  }
  function hideContextMenu() {
    const m = document.getElementById("ctx-menu");
    if (m) m.style.display = "none";
  }

  /**
   * 把当前 ws 的对话历史 → 调 LLM 总结 → 上传 ARM 为 Knowledge → 绑定到当前 Agent。
   * 完成后本地消息会被清空（run 记录保留）。再次进入 ws 时上下文已基于被沉淀的经验。
   */
  async function handleSummarize() {
    try {
      // 1) 预览
      const preview = await api(`/workspaces/${workspaceId}/summarize`, {
        method: "POST",
        body: { confirm: false },
      });
      const name = prompt(
        `将总结 ${preview.turnCount} 条对话为 1 条 Knowledge，并绑定到当前 Agent。\n\n` +
          `建议名称: ${preview.suggestedName}\n\n` +
          `可修改名称，留空使用建议名：`,
        preview.suggestedName,
      );
      if (name === null) return;  // 取消

      flashTip("🧠 正在调 LLM 总结（首次会调用 ARM），请稍候...");
      const result = await api(`/workspaces/${workspaceId}/summarize`, {
        method: "POST",
        body: { confirm: true, name: name.trim() || undefined },
      });
      const link = result.knowledge?.url
        ? `\n\n🔗 ${result.knowledge.url}`
        : "";
      alert(
        `✅ 总结完成\n\n` +
          `· Knowledge: ${result.knowledge?.name} (${result.knowledge?.id})${link}\n` +
          `· 绑定: ${result.binding ? `v${result.binding.version} ✓` : "❌（需手动绑定）"}\n` +
          `· 已清空本地 ${result.deletedMessages} 条消息\n\n` +
          `下次新建工作空间时这些经验会自动加载。`,
      );
      location.reload();
    } catch (e) {
      alert("总结失败: " + e.message);
    }
  }

  /**
   * 清空当前 ws 的所有消息（保留所有 run 记录）。
   * 比"总结为知识"更轻量：直接丢弃，不调 LLM / ARM。
   */
  async function handleClear() {
    try {
      const preview = await api(`/workspaces/${workspaceId}/clear`, {
        method: "POST",
        body: { confirm: false },
      });
      if (preview.messageCount === 0) {
        return alert("当前工作空间没有消息可清空");
      }
      if (!confirm(
        `确定清空 ${preview.messageCount} 条消息吗？\n\n` +
          `会保留：所有 Run 记录（标题、状态、统计）\n` +
          `会删除：所有 user / assistant 消息\n\n` +
          `此操作不可撤销！`,
      )) return;

      const result = await api(`/workspaces/${workspaceId}/clear`, {
        method: "POST",
        body: { confirm: true },
      });
      flashTip("🧹 " + result.msg);
      // 重载页面让 history 重新渲染（清空后 messagesBox 应该显示"开始新对话"）
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      alert("清空失败: " + e.message);
    }
  }

  function scrollToBottom() {
    const box = document.querySelector(".chat-messages");
    if (!box) return;
    requestAnimationFrame(() => {
      box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    });
  }

  /**
   * 节流渲染：流式 markdown 不需要每个 token 都重解析
   * 累积 delta，80ms 内合并后再渲染一次
   */
  function makeStreamRenderer(contentNode) {
    let pending = false;
    let lastRender = 0;
    const THROTTLE_MS = 80;
    const fullTextRef = { value: "" };
    // 用户是否在手动看历史：true 时不要 auto-scroll，尊重用户位置
    let userScrolledUp = false;
    const messagesBox = contentNode.closest(".chat-messages");

    function isAtBottom() {
      if (!messagesBox) return true;
      const threshold = 80;
      return messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight < threshold;
    }

    messagesBox?.addEventListener("scroll", () => {
      userScrolledUp = !isAtBottom();
    });

    function flush() {
      lastRender = Date.now();
      pending = false;
      contentNode.innerHTML = `<div class="md">${renderMarkdown(fullTextRef.value)}</div>`;
      // 只在用户没在手动看历史时自动滚动
      if (!userScrolledUp) {
        scrollToBottom();
      }
    }

    return {
      append(delta) {
        fullTextRef.value += delta;
        const now = Date.now();
        if (now - lastRender > THROTTLE_MS) {
          if (!pending) {
            pending = true;
            setTimeout(flush, THROTTLE_MS);
          }
        }
      },
      finalize() {
        flush(); // 最后一次完整渲染
      },
      getText() {
        return fullTextRef.value;
      },
    };
  }

  async function send() {
    const ta = $("#chat-textarea");
    const text = ta.value.trim();
    if (!text) return;
    if (isStreaming) return;  // 防御：流式时再点无效
    ta.value = "";
    autoresize();

    if (messagesBox.querySelector(".empty")) messagesBox.innerHTML = "";
    appendMessage(messagesBox, { role: "user", content: text });

    // 关键结构：role → tool-summary → content
    // tool-summary 一行紧凑，点击展开看每个工具明细
    // content 永远在最下面
    const contentNode = el("div", { class: "content", html: "" });
    const toolListNode = el("div", { class: "tool-list" });
    const toolSummary = createToolSummary(toolListNode);
    const assistantNode = el("div", { class: "msg assistant" }, [
      el("div", { class: "role" }, "assistant"),
      toolListNode,
      contentNode,
    ]);
    messagesBox.appendChild(assistantNode);
    const renderer = makeStreamRenderer(contentNode);
    scrollToBottom();

    // 当前 run 的 tool 调用状态
    const runTools = []; // { name, args, result, status, startTime, endTime, toolCallId }
    toolSummary._tools = runTools;

    setStreaming(true);
    try {
      const res = await fetch(`/api/ws/workspaces/${workspaceId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error("请求失败: HTTP " + res.status);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = parseSSE(buf);
        buf = events.rest;
        for (const ev of events.events) {
          handleStreamEvent(ev, contentNode, renderer, toolSummary, runTools);
        }
      }
      renderer.finalize();
      renderToolSummary(toolSummary, runTools);
      scrollToBottom();
    } catch (e) {
      renderer.append(`\n\n[错误] ${e.message}`);
      renderer.finalize();
      renderToolSummary(toolSummary, runTools);
      scrollToBottom();
    } finally {
      setStreaming(false);
    }
  }

  function handleStreamEvent(ev, contentNode, renderer, toolSummary, runTools) {
    const data = ev.data ?? {};
    switch (ev.event) {
      case "run.created":
        currentRunId = data.runId;
        break;
      case "message.delta":
        renderer.append(data.delta ?? "");
        break;
      case "tool.call.start": {
        runTools.push({
          name: data.toolName,
          args: data.args ?? {},
          result: null,
          status: "running",
          startTime: Date.now(),
          endTime: null,
          toolCallId: data.toolCallId,
        });
        renderToolSummary(toolSummary, runTools);
        scrollToBottom();
        break;
      }
      case "tool.call.end": {
        const t = runTools.find((x) => x.toolCallId === data.toolCallId);
        if (t) {
          t.status = data.isError ? "error" : "done";
          t.result = data.result;
          t.endTime = Date.now();
        }
        renderToolSummary(toolSummary, runTools);
        scrollToBottom();
        break;
      }
      case "run.done": {
        // run 结束（completed / aborted / failed）—— 恢复发送按钮
        // 主动 stop 触发的 abort 也会经过这里，data.status === "aborted"
        if (data.status === "aborted") {
          renderer.append(`\n\n_⏹ 已停止_`);
          renderer.finalize();
        }
        setStreaming(false);
        break;
      }
      case "error":
        renderer.append(`\n\n[错误] ${data.message ?? ""}`);
        break;
    }
  }

  function parseSSE(buf) {
    const events = [];
    let rest = buf;
    const lines = buf.split(/\n/);
    let cur = { event: "message", data: "" };
    let consumed = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === "") {
        if (cur.event || cur.data) {
          try { cur.data = JSON.parse(cur.data); } catch {}
          events.push({ ...cur });
        }
        cur = { event: "message", data: "" };
        consumed += line.length + 1;
      } else if (line.startsWith("event:")) {
        cur.event = line.slice(6).trim();
        consumed += line.length + 1;
      } else if (line.startsWith("data:")) {
        cur.data += line.slice(5).trim();
        consumed += line.length + 1;
      } else {
        consumed += line.length + 1;
      }
    }
    rest = buf.slice(consumed);
    return { events, rest };
  }

  async function rateHelpful(b) {
    currentHelpful = b;
    await submitFeedback();
  }
  async function rateStar(n) {
    currentRating = n;
    $$("#stars .star").forEach((s) => s.classList.toggle("active", Number(s.dataset.n) <= n));
    await submitFeedback();
  }
  async function submitFeedback() {
    if (!currentRunId) return alert("还没有 Run 可评分");
    try {
      await api(`/runs/${currentRunId}/feedback`, {
        method: "POST",
        body: {
          rating: currentRating || undefined,
          isHelpful: currentHelpful === null ? undefined : currentHelpful,
          comment: $("#comment")?.value || undefined,
        },
      });
      flashTip("✅ 反馈已发送到 ARM");
    } catch (e) {
      console.error("feedback err", e);
      alert("反馈提交失败: " + e.message);
    }
  }

  function flashTip(text) {
    const tip = el("div", { style: { position: "fixed", top: "70px", right: "24px", background: "#165dff", color: "#fff", padding: "8px 16px", borderRadius: "6px", zIndex: 100 } }, text);
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 2000);
  }

  // Enter 发送
  setTimeout(() => {
    const ta = $("#chat-textarea");
    ta?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }, 0);

  return wrap;
}

function tabLink(href, label, active = false) {
  return el("a", {
    href,
    onclick: (e) => { e.preventDefault(); navigate(href.slice(1)); },
    class: active ? "active" : "",
  }, label);
}

async function renderWorkspaceRuns(workspaceId) {
  const ws = await api(`/workspaces/${workspaceId}`).catch(() => null);
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([
    { label: "首页", href: "/" },
    { label: ws?.agentName ?? "Agent", href: `/agents/${ws?.agentId}` },
    { label: ws?.name ?? "WS", href: `/w/${workspaceId}/chat` },
    { label: "Runs" },
  ]));

  const tabs = el("div", { class: "tabs", style: { padding: "0 24px", background: "#fff", borderBottom: "1px solid #e5e6eb" } }, [
    tabLink(`#/w/${workspaceId}/chat`, "Chat"),
    tabLink(`#/w/${workspaceId}/runs`, "Runs", true),
    tabLink(`#/w/${workspaceId}/settings`, "Settings"),
  ]);
  wrap.appendChild(tabs);

  const container = el("div", { class: "container" });
  const runs = await api(`/workspaces/${workspaceId}/runs`).catch(() => []);
  if (runs.length === 0) {
    container.appendChild(el("div", { class: "empty" }, "还没有 Run"));
  } else {
    container.appendChild(el("div", { class: "cards" }, runs.map((r) =>
      el("div", { class: "card", onclick: () => navigate(`/runs/${r.id}`) }, [
        el("div", { class: "card-title" }, r.title || r.id.slice(0, 8)),
        el("div", { class: "card-sub" }, `状态: ${r.status} · ${r.toolCallCount ?? 0} 次工具调用`),
        el("div", { class: "card-meta" }, [
          el("span", { class: "tag" }, r.status),
          el("span", { class: "tag" }, fmtTime(r.createdAt)),
          r.durationMs ? el("span", { class: "tag" }, `${(r.durationMs / 1000).toFixed(1)}s`) : null,
        ]),
      ])
    )));
  }
  wrap.appendChild(container);
  return wrap;
}

async function renderWorkspaceSettings(workspaceId) {
  const ws = await api(`/workspaces/${workspaceId}`).catch(() => null);
  if (!ws) return el("div", { class: "empty" }, "不存在");
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([
    { label: "首页", href: "/" },
    { label: ws.agentName, href: `/agents/${ws.agentId}` },
    { label: ws.name, href: `/w/${workspaceId}/chat` },
    { label: "Settings" },
  ]));
  const tabs = el("div", { class: "tabs", style: { padding: "0 24px", background: "#fff", borderBottom: "1px solid #e5e6eb" } }, [
    tabLink(`#/w/${workspaceId}/chat`, "Chat"),
    tabLink(`#/w/${workspaceId}/runs`, "Runs"),
    tabLink(`#/w/${workspaceId}/settings`, "Settings", true),
  ]);
  wrap.appendChild(tabs);

  const container = el("div", { class: "container" });
  container.appendChild(el("h2", {}, "工作空间设置"));
  const form = el("div", {});
  form.appendChild(el("div", { class: "form-row" }, [
    el("label", {}, "名称"),
    el("input", { id: "ws-name", value: ws.name }),
  ]));
  form.appendChild(el("div", { class: "form-row" }, [
    el("label", {}, "场景描述"),
    el("textarea", { id: "ws-context", rows: 8 }, ws.context ?? ""),
  ]));
  form.appendChild(el("div", { class: "form-row" }, [
    el("label", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
      el("input", { type: "checkbox", id: "ws-enable-tools", checked: ws.enableTools, style: { width: "auto" } }),
      "启用工具（bash / 读写文件 / arm_cli）",
    ]),
    el("div", { class: "hint" }, [
      "开启后 Agent 可执行 shell、读写文件、调用 arm_cli。",
      el("br"),
      "⚠️ 没有沙箱。Agent 在隔离目录 ",
      el("code", {}, ws.cwd ?? `data/workspaces/${ws.id}`),
      " 下工作。",
    ]),
  ]));
  form.appendChild(el("div", { style: { display: "flex", gap: "8px" } }, [
    el("button", { class: "primary", onclick: async () => {
      await api(`/workspaces/${workspaceId}`, {
        method: "PUT",
        body: {
          name: $("#ws-name").value,
          context: $("#ws-context").value,
          enableTools: $("#ws-enable-tools").checked,
        },
      });
      alert("已保存");
    } }, "保存"),
    el("button", { class: "danger", onclick: async () => {
      if (!confirm("确认删除此工作空间？所有 Run 也会一起删除")) return;
      await api(`/workspaces/${workspaceId}`, { method: "DELETE" });
      navigate("/");
    } }, "删除工作空间"),
  ]));
  container.appendChild(form);
  wrap.appendChild(container);
  return wrap;
}

async function renderRunDetail(runId) {
  const data = await api(`/runs/${runId}`).catch(() => null);
  if (!data) return el("div", { class: "empty" }, "Run 不存在");
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([
    { label: "首页", href: "/" },
    { label: "Run" },
  ]));

  const container = el("div", { class: "container" });
  container.appendChild(el("div", { style: { marginBottom: "16px" } }, [
    el("h2", { style: { marginBottom: "4px" } }, data.title || runId.slice(0, 8)),
    el("div", { class: "muted" }, [
      el("span", { class: "tag" }, data.status),
      el("span", { class: "tag" }, fmtTime(data.createdAt)),
      data.durationMs ? el("span", { class: "tag" }, `${(data.durationMs / 1000).toFixed(1)}s`) : null,
      el("span", { class: "tag" }, `tools ${data.toolCallCount}`),
      el("a", { href: `#/contribute/${runId}`, onclick: (e) => { e.preventDefault(); navigate(`/contribute/${runId}`); }, style: { marginLeft: "8px" } }, "📤 沉淀为资产"),
    ]),
  ]));

  const box = el("div", { class: "chat-main", style: { padding: "16px" } });
  for (const m of data.messages ?? []) {
    const md = m.role === "user" || m.role === "tool" || m.role === "assistant";
    const contentHtml = md
      ? `<div class="md">${renderMarkdown(m.content ?? "")}</div>`
      : escapeHtml(m.content ?? "");
    const node = el("div", { class: `msg ${m.role}` }, [
      el("div", { class: "role" }, m.role + (m.toolName ? ` · ${m.toolName}` : "")),
      el("div", { class: "content", html: contentHtml }),
    ]);
    box.appendChild(node);
  }
  container.appendChild(box);

  container.appendChild(el("div", { class: "section" }, [
    el("h2", {}, "事件流"),
    el("pre", { class: "muted", style: { background: "#fafbfc", padding: "12px", borderRadius: "6px", overflow: "auto", maxHeight: "300px" } },
      JSON.stringify(data.events ?? [], null, 2)),
  ]));

  wrap.appendChild(container);
  return wrap;
}

async function renderContribute(runId) {
  const data = await api(`/runs/${runId}`).catch(() => null);
  const extracted = await api(`/runs/${runId}/extract`).catch(() => null);
  if (!data) return el("div", { class: "empty" }, "Run 不存在");
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([
    { label: "首页", href: "/" },
    { label: "沉淀" },
  ]));
  const container = el("div", { class: "container" });
  container.appendChild(el("h2", {}, "📤 把这次 Run 沉淀为 ARM 资产"));

  let assetType = "knowledge";
  const form = el("div", {});
  const refreshPreview = () => {
    form.innerHTML = "";
    form.appendChild(el("div", { class: "form-row" }, [
      el("label", {}, "沉淀为"),
      el("div", { style: { display: "flex", gap: "16px" } }, ["skill", "knowledge", "agent"].map((t) =>
        el("label", {}, [
          el("input", { type: "radio", name: "asset-type", value: t, checked: assetType === t, onchange: () => { assetType = t; refreshPreview(); }, style: { width: "auto", marginRight: "4px" } }),
          t,
        ]),
      )),
    ]));

    form.appendChild(el("div", { class: "form-row" }, [
      el("label", {}, "名称 *"),
      el("input", { id: "asset-name", value: assetType === "agent" ? extracted?.agentDefault?.name : (data.title || "") }),
    ]));
    form.appendChild(el("div", { class: "form-row" }, [
      el("label", {}, "描述"),
      el("input", { id: "asset-desc", placeholder: "（可选）" }),
    ]));

    if (assetType === "knowledge") {
      form.appendChild(el("div", { class: "form-row" }, [
        el("label", {}, "内容（默认从 Run 提取）"),
        el("textarea", { id: "asset-content", rows: 12 }, extracted?.knowledgeDefault ?? ""),
      ]));
    } else if (assetType === "skill") {
      form.appendChild(el("div", { class: "form-row" }, [
        el("div", { class: "hint" }, "Skill 上传需要 ZIP 文件 + SKILL.md，请使用 ARM CLI：arm skill upload <path>"),
        el("pre", { class: "muted", style: { background: "#fafbfc", padding: "8px", borderRadius: "6px", maxHeight: "200px", overflow: "auto" } }, extracted?.skillDefault || "(未从 Run 提取到代码块)"),
      ]));
    } else if (assetType === "agent") {
      form.appendChild(el("div", { class: "form-row" }, [
        el("label", {}, "Prompt（默认 = Agent.prompt + Workspace.context）"),
        el("textarea", { id: "asset-content", rows: 12 }, extracted?.agentDefault?.prompt ?? ""),
      ]));
    }

    form.appendChild(el("div", { style: { display: "flex", gap: "8px" } }, [
      el("button", { onclick: () => navigate(`/runs/${runId}`) }, "取消"),
      assetType === "skill"
        ? el("button", { class: "primary", onclick: () => alert("Skill 请用 CLI 上传：arm skill upload <path>") }, "查看 CLI 命令")
        : el("button", { class: "primary", onclick: async () => {
            const name = $("#asset-name").value.trim();
            if (!name) return alert("请填写名称");
            try {
              const res = await api(`/runs/${runId}/contribute`, {
                method: "POST",
                body: {
                  assetType,
                  name,
                  description: $("#asset-desc").value.trim(),
                  content: $("#asset-content")?.value,
                },
              });
              alert("已发布到 ARM: " + (res.armAssetName ?? res.status));
              navigate(`/runs/${runId}`);
            } catch (e) {
              alert("沉淀失败: " + e.message);
            }
          } }, "发布到 ARM"),
    ]));
  };
  refreshPreview();
  container.appendChild(form);
  wrap.appendChild(container);
  return wrap;
}

async function renderSettings() {
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([{ label: "首页", href: "/" }, { label: "设置" }]));
  const container = el("div", { class: "container" });
  const cfg = await api("/config").catch(() => null);
  container.appendChild(el("h2", {}, "⚙ 系统配置"));
  container.appendChild(el("div", { class: "muted", style: { marginBottom: "16px" } }, "（修改需要重启服务生效）"));
  const grid = el("div", { class: "kv", style: { fontSize: "14px" } });
  if (cfg) {
    grid.appendChild(el("div", { class: "k" }, "LLM Provider"));
    grid.appendChild(el("div", {}, cfg.llm.provider));
    grid.appendChild(el("div", { class: "k" }, "LLM Base URL"));
    grid.appendChild(el("div", {}, cfg.llm.baseUrl));
    grid.appendChild(el("div", { class: "k" }, "Default Model"));
    grid.appendChild(el("div", {}, cfg.llm.defaultModel));
    grid.appendChild(el("div", { class: "k" }, "API Key"));
    grid.appendChild(el("div", {}, cfg.llm.apiKeyMasked || "(未配置)"));
    grid.appendChild(el("div", { class: "k" }, "ARM Base URL"));
    grid.appendChild(el("div", {}, cfg.arm.baseUrl));
    grid.appendChild(el("div", { class: "k" }, "Server"));
    grid.appendChild(el("div", {}, `${cfg.server.host}:${cfg.server.port}`));
    grid.appendChild(el("div", { class: "k" }, "arm_cli Tool"));
    grid.appendChild(el("div", {}, `${cfg.armCliTool.enabled ? "✅ 启用" : "❌ 停用"} · ${cfg.armCliTool.cliPath}`));
  }
  container.appendChild(grid);
  container.appendChild(el("div", { class: "divider" }));
  container.appendChild(el("h2", {}, "🩺 健康检查"));
  try {
    const health = await (await fetch("/health")).json();
    container.appendChild(el("pre", { class: "muted", style: { background: "#fafbfc", padding: "12px", borderRadius: "6px" } },
      JSON.stringify(health, null, 2)));
  } catch (e) {
    container.appendChild(el("div", { class: "empty" }, "健康检查失败"));
  }
  wrap.appendChild(container);
  return wrap;
}

// 通用：详情页头（avatar + 标题 + 描述 + 反馈聚合）
function renderDetailHeader({ avatar, name, description, version, status, tags, feedbackSummary }) {
  return el("div", { class: "section" }, [
    el("div", { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" } }, [
      el("div", {
        style: {
          width: "48px", height: "48px", borderRadius: "10px",
          background: "#f2f3f5", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", overflow: "hidden", flexShrink: 0,
        },
      }, avatar
        ? el("img", { src: avatar, style: { width: "100%", height: "100%", objectFit: "cover" } })
        : "📦"),
      el("div", {}, [
        el("div", { style: { fontSize: "20px", fontWeight: 700 } }, name),
        el("div", { class: "muted", style: { fontSize: "13px" } }, description ?? ""),
      ]),
    ]),
    el("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, [
      version ? el("span", { class: "tag" }, `v${version}`) : null,
      status ? el("span", { class: "tag" }, status) : null,
      feedbackSummary?.total > 0
        ? el("span", { class: "tag", style: { background: "#fff7e6", color: "#d46b08" } },
            `★ ${feedbackSummary.avgRating ?? "-"} (${feedbackSummary.total})`)
        : null,
      feedbackSummary?.helpfulCount > 0
        ? el("span", { class: "tag" }, `👍 ${feedbackSummary.helpfulCount}`) : null,
      feedbackSummary?.unhelpfulCount > 0
        ? el("span", { class: "tag" }, `👎 ${feedbackSummary.unhelpfulCount}`) : null,
      ...(tags ?? []).map((t) => el("span", { class: "tag" }, `#${t}`)),
    ]),
  ]);
}

// 通用：反馈表单
function FeedbackForm({ onSubmit, submitLabel = "提交反馈" }) {
  let rating = 0;
  let isHelpful = null;
  let comment = "";
  return el("div", { class: "card" }, [
    el("div", { class: "card-title" }, submitLabel),
    el("div", { style: { display: "flex", gap: "8px", margin: "8px 0" } }, [
      el("span", { class: "muted", style: { fontSize: "12px", alignSelf: "center" } }, "评分:"),
      el("div", { style: { display: "flex", gap: "2px" } },
        [1, 2, 3, 4, 5].map((n) =>
          el("span", {
            style: { cursor: "pointer", fontSize: "18px", color: "#c9cdd4" },
            onclick: () => {
              rating = n;
              // 重绘 stars
              const stars = starsRef.querySelectorAll("span");
              stars.forEach((s, i) => s.style.color = i < n ? "#ff7d00" : "#c9cdd4");
            },
          }, "☆")
        )
      ),
    ]),
    el("div", { style: { display: "flex", gap: "8px", margin: "8px 0" } }, [
      el("span", { class: "muted", style: { fontSize: "12px", alignSelf: "center" } }, "是否有用:"),
      el("button", { onclick: () => { isHelpful = true; }, style: { fontSize: "12px", padding: "2px 8px" } }, "👍"),
      el("button", { onclick: () => { isHelpful = false; }, style: { fontSize: "12px", padding: "2px 8px" } }, "👎"),
    ]),
    el("textarea", { id: "fb-comment", rows: 3, placeholder: "可选：写几句评论", oninput: (e) => { comment = e.target.value; }, style: { width: "100%" } }),
    el("div", { style: { marginTop: "8px" } }, [
      el("button", { class: "primary", onclick: () => onSubmit({ rating, isHelpful, comment }) }, submitLabel),
    ]),
  ]);
  // 注意：上面的 stars 创建在 el() 调用栈里，闭包拿不到。改用 ref 模式：
}

// 简化：直接 inline 反馈表单到页面
function renderFeedbackForm(onSubmit, submitLabel) {
  const starsRef = { value: null };
  const wrap = el("div", { class: "card" });
  const render = ({ rating, isHelpful, comment }) => {
    wrap.innerHTML = "";
    wrap.appendChild(el("div", { class: "card-title" }, submitLabel || "提交反馈"));
    const stars = el("div", { style: { display: "flex", gap: "2px" } });
    const starEls = [];
    for (let n = 1; n <= 5; n++) {
      const s = el("span", {
        style: { cursor: "pointer", fontSize: "20px", color: rating >= n ? "#ff7d00" : "#c9cdd4" },
        onclick: () => render({ rating: n, isHelpful, comment }),
      }, "★");
      starEls.push(s);
      stars.appendChild(s);
    }
    wrap.appendChild(el("div", { style: { display: "flex", gap: "8px", alignItems: "center", margin: "8px 0" } }, [
      el("span", { class: "muted", style: { fontSize: "12px" } }, "评分:"),
      stars,
    ]));
    wrap.appendChild(el("div", { style: { display: "flex", gap: "8px", alignItems: "center", margin: "6px 0" } }, [
      el("span", { class: "muted", style: { fontSize: "12px" } }, "是否有用:"),
      el("button", {
        onclick: () => render({ rating, isHelpful: true, comment }),
        style: {
          fontSize: "12px", padding: "2px 10px",
          background: isHelpful === true ? "#165dff" : "#f2f3f5",
          color: isHelpful === true ? "#fff" : "#1f2329",
          border: "1px solid #dcdfe6",
        },
      }, "👍 有用"),
      el("button", {
        onclick: () => render({ rating, isHelpful: false, comment }),
        style: {
          fontSize: "12px", padding: "2px 10px",
          background: isHelpful === false ? "#f53f3f" : "#f2f3f5",
          color: isHelpful === false ? "#fff" : "#1f2329",
          border: "1px solid #dcdfe6",
        },
      }, "👎 没用"),
    ]));
    wrap.appendChild(el("textarea", {
      rows: 3,
      placeholder: "可选：写几句评论",
      style: { width: "100%", fontFamily: "inherit" },
      oninput: (e) => { comment = e.target.value; },
    }, comment || ""));
    wrap.appendChild(el("div", { style: { marginTop: "8px" } }, [
      el("button", {
        class: "primary",
        onclick: () => onSubmit({ rating, isHelpful, comment }),
      }, "提交"),
    ]));
  };
  render({ rating: 0, isHelpful: null, comment: "" });
  return wrap;
}

function renderFeedbackList(items) {
  if (!items || items.length === 0) {
    return el("div", { class: "muted", style: { padding: "12px", textAlign: "center" } }, "暂无反馈");
  }
  return el("div", { class: "section" }, [
    el("h2", { style: { fontSize: "16px", marginBottom: "8px" } }, `反馈 (${items.length})`),
    ...items.map((f) => el("div", { class: "card", style: { marginBottom: "6px", padding: "10px 12px" } }, [
      el("div", { style: { display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" } }, [
        el("span", { style: { color: "#ff7d00" } },
          f.rating ? "★".repeat(f.rating) + "☆".repeat(5 - f.rating) : "未评分"),
        f.isHelpful === true ? el("span", { style: { color: "#00b42a" } }, "👍") :
        f.isHelpful === false ? el("span", { style: { color: "#f53f3f" } }, "👎") : null,
        el("span", { class: "muted", style: { marginLeft: "auto", fontSize: "11px" } }, fmtTime(f.createdAt ? new Date(f.createdAt).getTime() : null)),
      ]),
      f.comment ? el("div", { style: { marginTop: "6px", fontSize: "13px" } }, f.comment) : null,
      f.tags?.length ? el("div", { style: { marginTop: "4px" } }, f.tags.map((t) => el("span", { class: "tag" }, t))) : null,
    ])),
  ]);
}

// 通用：详情页布局
function buildDetailPage({ wrap, name, description, version, status, avatar, feedbackSummary, tags, formSection, listSection, topbarCrumbs }) {
  wrap.appendChild(renderTopbar(topbarCrumbs));
  const container = el("div", { class: "container" });
  container.appendChild(renderDetailHeader({ avatar, name, description, version, status, tags, feedbackSummary }));
  if (formSection) container.appendChild(formSection);
  if (listSection) container.appendChild(listSection);
  wrap.appendChild(container);
  return wrap;
}

// ──────────── Skill 详情页 ────────────
async function renderSkillDetail(name) {
  const wrap = el("div", {});
  const data = await api(`/skills/${encodeURIComponent(name)}`).catch(() => null);
  if (!data) {
    wrap.appendChild(renderTopbar([{ label: "首页", href: "/" }, { label: name }]));
    const c = el("div", { class: "container" }, el("div", { class: "empty" }, "Skill 不存在"));
    wrap.appendChild(c);
    return wrap;
  }
  const fbList = await api(`/skills/${data.id}/feedback`).catch(() => ({ items: [], total: 0 }));
  const form = renderFeedbackForm(async ({ rating, isHelpful, comment }) => {
    if (!rating && isHelpful === null && !comment) return alert("请至少评分或写评论");
    try {
      await api(`/skills/${data.id}/feedback`, { method: "POST", body: { rating, isHelpful, comment } });
      alert("反馈已提交，作者将看到通知（如评分 ≤ 3★）");
      // 刷新
      location.reload();
    } catch (e) {
      alert("提交失败: " + e.message);
    }
  }, "对 Skill 评分");
  buildDetailPage({
    wrap,
    name: data.name,
    description: data.description,
    version: data.version,
    status: data.status,
    avatar: data.publishedBy?.id ? null : null,
    feedbackSummary: data.feedbackSummary,
    tags: data.tags,
    formSection: form,
    listSection: renderFeedbackList(fbList.items),
    topbarCrumbs: [{ label: "首页", href: "/" }, { label: data.name }],
  });
  return wrap;
}

// ──────────── Knowledge 详情页 ────────────
async function renderKnowledgeDetail(id) {
  const wrap = el("div", {});
  const data = await api(`/knowledges/${encodeURIComponent(id)}`).catch(() => null);
  if (!data) {
    wrap.appendChild(renderTopbar([{ label: "首页", href: "/" }, { label: id }]));
    const c = el("div", { class: "container" }, el("div", { class: "empty" }, "Knowledge 不存在"));
    wrap.appendChild(c);
    return wrap;
  }
  const fbList = await api(`/knowledges/${data.id}/feedback`).catch(() => ({ items: [], total: 0 }));
  const form = renderFeedbackForm(async ({ rating, isHelpful, comment }) => {
    if (!rating && isHelpful === null && !comment) return alert("请至少评分或写评论");
    try {
      await api(`/knowledges/${data.id}/feedback`, { method: "POST", body: { rating, isHelpful, comment } });
      alert("反馈已提交，作者将看到通知（如评分 ≤ 3★）");
      location.reload();
    } catch (e) {
      alert("提交失败: " + e.message);
    }
  }, "对 Knowledge 评分");
  buildDetailPage({
    wrap,
    name: data.name,
    description: data.description,
    version: data.version,
    status: undefined,
    feedbackSummary: data.feedbackSummary,
    tags: data.tags,
    formSection: form,
    listSection: renderFeedbackList(fbList.items),
    topbarCrumbs: [{ label: "首页", href: "/" }, { label: data.name }],
  });
  return wrap;
}

// ──────────── 我的资产（作者后台） ────────────
async function renderAuthored() {
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([{ label: "首页", href: "/" }, { label: "我的资产" }]));
  const container = el("div", { class: "container" });
  const data = await api(`/my-agents?createdBy=${encodeURIComponent(CURRENT_USER?.id ?? "")}`).catch(() => ({ agents: [] }));
  container.appendChild(el("h2", {}, `📦 我创建的 Agent (${data.agents.length})`));
  if (data.agents.length === 0) {
    container.appendChild(el("div", { class: "empty" }, "还没有创建过 Agent。Mock 数据下，用 mock-arm 也能展示反馈。"));
  } else {
    container.appendChild(el("div", { class: "cards" }, data.agents.map((a) =>
      el("div", {
        class: "card",
        onclick: () => navigate(`/me/authored/${a.id}`),
      }, [
        el("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" } }, [
          renderAgentAvatar(a, 32),
          el("div", { class: "card-title", style: { marginBottom: 0 } }, a.name),
        ]),
        el("div", { class: "card-sub" }, a.description),
        el("div", { class: "card-meta" }, [
          el("span", { class: "tag" }, `v${a.version}`),
          a.feedbackSummary?.total > 0
            ? el("span", { class: "tag", style: { background: "#fff7e6", color: "#d46b08" } },
                `★ ${a.feedbackSummary.avgRating ?? "-"} (${a.feedbackSummary.total})`)
            : el("span", { class: "tag" }, "暂无评分"),
          a.feedbackSummary?.lowScore > 0
            ? el("span", { class: "tag", style: { background: "#ffece8", color: "#f53f3f" } },
                `⚠️ ${a.feedbackSummary.lowScore} 条低分`)
            : null,
        ]),
        el("div", { class: "muted", style: { fontSize: "11px", marginTop: "4px" } }, fmtTime(a.updatedAt ? new Date(a.updatedAt).getTime() : null)),
      ])
    )));
  }
  wrap.appendChild(container);
  return wrap;
}

// ──────────── 修改 Agent (作者用) ────────────
async function renderEditAgent(id) {
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([
    { label: "首页", href: "/" },
    { label: "我的资产", href: "/me/authored" },
    { label: "编辑" },
  ]));
  const container = el("div", { class: "container" });
  const detail = await api(`/agents/${encodeURIComponent(id)}`).catch(() => null);
  if (!detail) {
    container.appendChild(el("div", { class: "empty" }, "Agent 不存在"));
    wrap.appendChild(container);
    return wrap;
  }

  let prompt = detail.prompt;
  let description = detail.description;
  let status = detail.status;

  container.appendChild(el("h2", {}, `✏️ 编辑 ${detail.name}`));
  container.appendChild(el("div", { class: "muted", style: { marginBottom: "16px" } },
    `当前版本 v${detail.version}。修改 prompt 后保存会自动递增 patch 版本号（如 1.0.0 → 1.0.1）`));

  // 双栏布局：左侧编辑表单，右侧 sticky 反馈面板
  const layout = el("div", { class: "edit-layout" });
  const formCol = el("div", { class: "edit-form-col" });
  const sideCol = el("div", { class: "edit-side-col" });

  const form = el("div", { class: "card" });
  form.appendChild(el("div", { class: "form-row" }, [
    el("label", {}, "描述"),
    el("input", { id: "edit-desc", value: description ?? "" }),
  ]));
  form.appendChild(el("div", { class: "form-row" }, [
    el("label", {}, "Prompt *"),
    el("textarea", { id: "edit-prompt", rows: 16, style: { fontFamily: "ui-monospace, monospace", fontSize: "12.5px" } }, prompt || ""),
  ]));
  form.appendChild(el("div", { class: "form-row" }, [
    el("label", {}, "状态"),
    el("select", { id: "edit-status" }, [
      el("option", { value: "active", selected: status === "active" }, "active"),
      el("option", { value: "draft", selected: status === "draft" }, "draft"),
    ]),
  ]));
  form.appendChild(el("div", { style: { display: "flex", gap: "8px" } }, [
    el("button", { class: "primary", onclick: async () => {
      const newPrompt = $("#edit-prompt").value;
      const newDesc = $("#edit-desc").value;
      const newStatus = $("#edit-status").value;
      try {
        const updated = await api(`/agents/${id}`, {
          method: "PUT",
          body: { prompt: newPrompt, description: newDesc, status: newStatus },
        });
        alert(`已保存，新版本 v${updated.version}`);
        navigate("/me/authored");
      } catch (e) {
        alert("保存失败: " + e.message);
      }
    } }, "保存（自动 +0.0.1）"),
    el("button", { onclick: () => navigate("/me/authored") }, "取消"),
  ]));
  formCol.appendChild(form);

  // 右侧反馈面板：summary + 重点问题 + 全部 + 排序/筛选
  sideCol.appendChild(renderEditFeedbackPanel(id));

  layout.appendChild(formCol);
  layout.appendChild(sideCol);
  container.appendChild(layout);

  wrap.appendChild(container);
  return wrap;
}

/**
 * 编辑页右侧 sticky 反馈面板：
 * - 顶部 summary（avg + 👍/👎 + 趋势）
 * - 重点问题：rating ≤ 3 或 👎 的反馈（置顶高亮）
 * - 全部反馈：支持按时间 / 评分排序，全部 / 仅差评筛选
 */
function renderEditFeedbackPanel(agentId) {
  const panel = el("div", { class: "edit-fb-panel" });
  panel.appendChild(el("div", { class: "muted", style: { padding: "20px", textAlign: "center" } }, "加载反馈中…"));

  // 异步加载并填充
  api(`/agents/${encodeURIComponent(agentId)}/feedback?limit=100`)
    .then((fb) => {
      panel.innerHTML = "";
      const items = fb?.items ?? [];
      const summary = {
        total: fb?.total ?? items.length,
        avgRating: fb?.avgRating,
        helpfulCount: fb?.helpfulCount ?? items.filter((i) => i.isHelpful === true).length,
        unhelpfulCount: fb?.unhelpfulCount ?? items.filter((i) => i.isHelpful === false).length,
      };
      panel.appendChild(buildEditFbSummary(summary, items));
      panel.appendChild(buildEditFbCritical(items));
      panel.appendChild(buildEditFbFullList(items));
    })
    .catch((e) => {
      panel.innerHTML = "";
      panel.appendChild(el("div", { class: "empty", style: { padding: "20px" } },
        `反馈加载失败: ${e.message}`));
    });

  return panel;
}

/** 评分 summary 块（大字号 avg + 数量 + 趋势） */
function buildEditFbSummary(summary, items) {
  const wrap = el("div", { class: "fb-summary" });
  if (summary.total === 0) {
    wrap.appendChild(el("div", { class: "fb-empty muted" },
      "📊 还没有反馈 —— 邀请用户试用以收集数据"));
    return wrap;
  }
  const avg = summary.avgRating ?? 0;
  const tier = ratingTier(avg);
  wrap.appendChild(el("div", { class: "fb-summary-score" }, [
    el("div", { class: `fb-avg tier-${tier}` }, avg.toFixed(1)),
    el("div", { class: "fb-stars" },
      "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg))),
  ]));
  wrap.appendChild(el("div", { class: "fb-breakdown" }, [
    el("div", {}, `${summary.total} 条反馈`),
    summary.helpfulCount > 0
      ? el("div", { class: "fb-good" }, `👍 有用 ${summary.helpfulCount}`)
      : null,
    summary.unhelpfulCount > 0
      ? el("div", { class: "fb-bad" }, `👎 没用 ${summary.unhelpfulCount}`)
      : null,
    computeEditFbTrend(items) ?
      el("div", { class: "muted", style: { fontSize: "12px", marginTop: "4px" } }, computeEditFbTrend(items))
      : null,
  ]));
  return wrap;
}

/**
 * 简单趋势：把反馈按时间二分（最近一半 vs 之前一半），对比均分
 * - 上升 → "近期均分上升 ↑"
 * - 下降 → "近期均分下降 ↓"
 * - 否则 → "评分稳定 —"
 */
function computeEditFbTrend(items) {
  if (items.length < 4) return null;  // 数据太少不显示
  const sorted = [...items].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const mid = Math.floor(sorted.length / 2);
  const recent = sorted.slice(0, mid);
  const older = sorted.slice(mid);
  const avg = (arr) => {
    const rs = arr.map((i) => i.rating).filter((r) => typeof r === "number");
    return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
  };
  const recentAvg = avg(recent);
  const olderAvg = avg(older);
  const diff = recentAvg - olderAvg;
  if (Math.abs(diff) < 0.3) return "📈 近期评分稳定 —";
  return diff > 0
    ? `📈 近期均分上升 ↑（${olderAvg.toFixed(1)} → ${recentAvg.toFixed(1)}）`
    : `📉 近期均分下降 ↓（${olderAvg.toFixed(1)} → ${recentAvg.toFixed(1)}）`;
}

/** 重点问题区：rating ≤ 3 或 👎 的反馈 */
function buildEditFbCritical(items) {
  const critical = items.filter((i) =>
    (typeof i.rating === "number" && i.rating <= 3) || i.isHelpful === false
  );
  if (critical.length === 0) return el("div", {});  // 没差评就不渲染该区

  const wrap = el("div", { class: "edit-fb-critical" });
  wrap.appendChild(el("div", { class: "edit-fb-critical-head" }, [
    el("span", { class: "edit-fb-critical-title" }, "⚠️ 需关注"),
    el("span", { class: "muted" }, ` (${critical.length} 条差评 / 标记没用)`),
  ]));
  const list = el("div", { class: "fb-list" });
  for (const it of critical.slice(0, 10)) {
    list.appendChild(renderAgentFeedbackItem(it, { critical: true }));
  }
  if (critical.length > 10) {
    list.appendChild(el("div", { class: "muted", style: { textAlign: "center", padding: "8px" } },
      `还有 ${critical.length - 10} 条差评，请在下方"仅差评"筛选中查看`));
  }
  wrap.appendChild(list);
  return wrap;
}

/** 全部反馈：带排序/筛选 */
function buildEditFbFullList(items) {
  const wrap = el("div", { class: "edit-fb-full" });
  const head = el("div", { class: "edit-fb-full-head" }, [
    el("span", { style: { fontWeight: 600 } }, "💬 全部反馈"),
    el("span", { class: "muted" }, ` (${items.length})`),
  ]);
  wrap.appendChild(head);

  if (items.length === 0) {
    wrap.appendChild(el("div", { class: "empty", style: { padding: "20px" } },
      "暂无反馈"));
    return wrap;
  }

  // 排序 + 筛选控件
  const sortSel = el("select", { class: "edit-fb-sort" }, [
    el("option", { value: "time" }, "按时间（新→旧）"),
    el("option", { value: "rating-asc" }, "按评分（低→高）"),
    el("option", { value: "rating-desc" }, "按评分（高→低）"),
  ]);
  const filterSel = el("select", { class: "edit-fb-filter" }, [
    el("option", { value: "all" }, "全部"),
    el("option", { value: "critical" }, "仅差评 (≤3星/没用)"),
    el("option", { value: "with-comment" }, "有评论"),
  ]);
  const controls = el("div", { class: "edit-fb-controls" }, [
    el("label", {}, [el("span", { class: "muted" }, "排序 "), sortSel]),
    el("label", {}, [el("span", { class: "muted" }, "筛选 "), filterSel]),
  ]);
  wrap.appendChild(controls);

  const list = el("div", { class: "fb-list" });
  const apply = () => {
    const sort = sortSel.value;
    const filter = filterSel.value;
    let data = items.slice();
    if (filter === "critical") {
      data = data.filter((i) =>
        (typeof i.rating === "number" && i.rating <= 3) || i.isHelpful === false);
    } else if (filter === "with-comment") {
      data = data.filter((i) => i.comment && i.comment.trim());
    }
    if (sort === "time") {
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === "rating-asc") {
      data.sort((a, b) => (a.rating ?? 99) - (b.rating ?? 99));
    } else if (sort === "rating-desc") {
      data.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    }
    list.innerHTML = "";
    if (data.length === 0) {
      list.appendChild(el("div", { class: "muted", style: { textAlign: "center", padding: "12px" } },
        "当前筛选下无数据"));
      return;
    }
    for (const it of data) {
      list.appendChild(renderAgentFeedbackItem(it));
    }
  };
  sortSel.addEventListener("change", apply);
  filterSel.addEventListener("change", apply);
  wrap.appendChild(list);
  apply();
  return wrap;
}

// ──────────── 通知中心 ────────────
async function renderNotifications() {
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([{ label: "首页", href: "/" }, { label: "通知" }]));
  const container = el("div", { class: "container" });

  const data = await api(`/notifications?userId=${encodeURIComponent(CURRENT_USER?.id ?? "")}`).catch(() => ({ items: [], unreadCount: 0 }));
  container.appendChild(el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, [
    el("h2", {}, `🔔 通知 (${data.unreadCount} 未读 / ${data.total})`),
    data.unreadCount > 0
      ? el("button", { onclick: async () => {
          await api(`/notifications/read-all`, { method: "POST", body: { userId: CURRENT_USER?.id ?? "" } });
          location.reload();
        } }, "全部标记已读")
      : null,
  ]));

  if (data.items.length === 0) {
    container.appendChild(el("div", { class: "empty" }, "暂无通知"));
  } else {
    data.items.forEach((n) => {
      const card = el("div", {
        class: "card",
        style: {
          marginBottom: "6px",
          padding: "10px 12px",
          background: n.isRead ? "#fff" : "#f0f7ff",
          borderLeft: n.isRead ? "3px solid #e5e6eb" : "3px solid #165dff",
          cursor: "pointer",
        },
        onclick: async () => {
          if (!n.isRead) {
            await api(`/notifications/${n.id}/read`, { method: "POST" });
          }
          // 跳到对应资产
          if (n.type === "agent_feedback") {
            // 跳到我的资产那个 agent
            navigate("/me/authored");
          } else {
            // 暂时回首页
            navigate("/");
          }
        },
      }, [
        el("div", { style: { display: "flex", alignItems: "center", gap: "6px" } }, [
          n.isRead ? null : el("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: "#165dff" } }),
          el("span", { style: { fontWeight: n.isRead ? 400 : 600, fontSize: "13px" } }, n.title),
          el("span", { class: "muted", style: { marginLeft: "auto", fontSize: "11px" } }, fmtTime(n.createdAt ? new Date(n.createdAt).getTime() : null)),
        ]),
        n.body ? el("div", { style: { marginTop: "4px", fontSize: "12px", color: "#4e5969" } }, n.body) : null,
      ]);
      container.appendChild(card);
    });
  }
  wrap.appendChild(container);
  return wrap;
}

// ──────────── 使用历史 ────────────
async function renderHistory() {
  const wrap = el("div", {});
  wrap.appendChild(renderTopbar([{ label: "首页", href: "/" }, { label: "使用历史" }]));
  const container = el("div", { class: "container" });

  const data = await api(`/me/history?limit=20`).catch(() => ({ items: [] }));
  container.appendChild(el("h2", {}, `🕘 最近用过的 Agent (${data.items.length})`));
  if (data.items.length === 0) {
    container.appendChild(el("div", { class: "empty" }, "还没有使用记录。新建工作空间开始对话吧"));
  } else {
    data.items.forEach((h) => {
      const card = el("div", {
        class: "card",
        style: { marginBottom: "6px" },
        onclick: () => navigate(`/agents/${h.agentId}`),
      }, [
        el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, [
          el("div", {}, [
            el("div", { class: "card-title", style: { marginBottom: 0 } }, h.agentName),
            el("div", { class: "muted", style: { fontSize: "11px" } }, `${h.runCount} 次对话 · 最近 ${fmtTime(h.lastRunAt)}`),
          ]),
        ]),
      ]);
      container.appendChild(card);
    });
  }
  wrap.appendChild(container);
  return wrap;
}

// 把新页面函数挂到 window，供 main.js 的路由系统使用
Object.assign(window, {
  renderSkillDetail,
  renderKnowledgeDetail,
  renderAuthored,
  renderEditAgent,
  renderNotifications,
  renderHistory,
  CURRENT_USER,
  fetchUnreadCount,
});
