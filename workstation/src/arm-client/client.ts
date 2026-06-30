import { config } from "../config.ts";
import type { ApiResponse, ArmAgent, ArmAgentDetail } from "../types.ts";
import { normalizeAvatar } from "../utils/avatar.ts";

/** 把 ARM 返回的 avatar 字段预处理成可直接渲染的字符串（data URI / emoji / URL） */
function withAvatar<T extends { avatar?: string }>(a: T): T & { avatarDisplay: string; avatarKind: string } {
  const n = normalizeAvatar(a.avatar);
  return { ...a, avatar: n.display, avatarDisplay: n.display, avatarKind: n.kind };
}

export class ArmClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = (baseUrl ?? config.arm.baseUrl).replace(/\/+$/, "");
    this.apiKey = apiKey ?? config.arm.apiKey;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async login(apiKey: string): Promise<{ user: { id: string; name: string; email: string; role: string }; token: string } | null> {
    const res = await this.request<{ user: any; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ apiKey }),
    });
    return res.ok && res.data ? res.data : null;
  }

  async getMe(): Promise<{ id: string; name: string; email: string; role: string } | null> {
    const res = await this.request<any>("/auth/me");
    return res.ok && res.data ? res.data : null;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    try {
      const res = await fetch(url, { ...init, headers });
      const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
      if (!json) {
        return { ok: false, data: null, msg: `ARM 无响应: HTTP ${res.status}` };
      }
      return json;
    } catch (e: any) {
      return { ok: false, data: null, msg: `ARM 连接失败: ${e?.message ?? String(e)}` };
    }
  }

  // ──────────────── Agents ────────────────

  async listAgents(params: { keyword?: string; page?: number; pageSize?: number; status?: string } = {}): Promise<{
    agents: ArmAgent[];
    total: number;
    page: number;
    pageSize: number;
  } | null> {
    const sp = new URLSearchParams();
    if (params.keyword) sp.set("keyword", params.keyword);
    if (params.page) sp.set("page", String(params.page));
    if (params.pageSize) sp.set("pageSize", String(params.pageSize));
    if (params.status) sp.set("status", params.status);
    const qs = sp.toString();
    const res = await this.request<{
      agents: ArmAgent[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/agents${qs ? `?${qs}` : ""}`);
    if (!res.ok || !res.data) return null;
    return {
      ...res.data,
      agents: res.data.agents.map(withAvatar),
    };
  }

  async getAgent(id: string): Promise<ArmAgentDetail | null> {
    const res = await this.request<{ agent?: ArmAgentDetail } & ArmAgentDetail>(
      `/agents/${encodeURIComponent(id)}`,
    );
    if (!res.ok || !res.data) return null;
    const d: any = res.data;
    return withAvatar(d.agent ?? d);
  }

  /**
   * 批量取多个 Agent 的反馈聚合。
   * 对应 ARM `POST /api/v1/agents/batch-summary`。
   * 替代 N+1 的 getAgent（每个 agent 单独拉一次 feedbackSummary）。
   * - 入参：agentId 列表（内部去重）
   * - 返回：{ [agentId]: { total, avgRating, helpfulCount, unhelpfulCount } }，缺失的 agentId 不会出现
   */
  async batchAgentSummary(
    agentIds: string[],
  ): Promise<Record<string, { total: number; avgRating: number | null; helpfulCount: number; unhelpfulCount: number }>> {
    const ids = Array.from(new Set(agentIds));
    if (ids.length === 0) return {};
    const res = await this.request<{ summaries: Record<string, any> }>(`/agents/batch-summary`, {
      method: "POST",
      body: JSON.stringify({ agentIds: ids }),
    });
    if (!res.ok || !res.data) return {};
    return res.data.summaries ?? {};
  }

  async createAgent(payload: {
    name: string;
    description?: string;
    prompt: string;
    status?: string;
  }): Promise<ArmAgent | null> {
    const res = await this.request<ArmAgent>(`/agents`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.data) return null;
    return res.data;
  }

  async createAgentFeedback(
    agentId: string,
    payload: {
      rating?: number | null;
      isHelpful?: boolean | null;
      comment?: string | null;
      tags?: string[] | null;
      agentVersion?: string | null;
      externalRunId?: string | null;
      source?: string;
    },
  ): Promise<{ id: string } | null> {
    const res = await this.request<{ id: string }>(
      `/agents/${encodeURIComponent(agentId)}/feedback`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return res.ok && res.data ? res.data : null;
  }

  async createSkillFeedback(
    skillId: string,
    payload: {
      rating?: number | null;
      isHelpful?: boolean | null;
      comment?: string | null;
      tags?: string[] | null;
      version?: string | null;
      externalRunId?: string | null;
      source?: string;
    },
  ): Promise<{ id: string } | null> {
    const res = await this.request<{ id: string }>(
      `/skills/${encodeURIComponent(skillId)}/feedback`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return res.ok && res.data ? res.data : null;
  }

  async getSkillFeedbacks(
    skillId: string,
    limit = 50,
  ): Promise<{ total: number; avgRating: number | null; items: any[] } | null> {
    const res = await this.request<any>(
      `/skills/${encodeURIComponent(skillId)}/feedback?limit=${limit}`,
    );
    return res.ok && res.data ? res.data : null;
  }

  async createKnowledgeFeedback(
    knowledgeId: string,
    payload: {
      rating?: number | null;
      isHelpful?: boolean | null;
      comment?: string | null;
      tags?: string[] | null;
      version?: string | null;
      externalRunId?: string | null;
      source?: string;
    },
  ): Promise<{ id: string } | null> {
    const res = await this.request<{ id: string }>(
      `/knowledges/${encodeURIComponent(knowledgeId)}/feedback`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return res.ok && res.data ? res.data : null;
  }

  async getKnowledgeFeedbacks(
    knowledgeId: string,
    limit = 50,
  ): Promise<{ total: number; avgRating: number | null; items: any[] } | null> {
    const res = await this.request<any>(
      `/knowledges/${encodeURIComponent(knowledgeId)}/feedback?limit=${limit}`,
    );
    return res.ok ? res.data : null;
  }

  async getAgentFeedbacks(
    agentId: string,
    limit = 50,
  ): Promise<{
    total: number;
    avgRating: number | null;
    helpfulCount: number;
    unhelpfulCount: number;
    items: any[];
  } | null> {
    const res = await this.request<any>(
      `/agents/${encodeURIComponent(agentId)}/feedback?limit=${limit}`,
    );
    return res.ok ? res.data : null;
  }

  async getMyAgents(createdBy: string): Promise<{ total: number; agents: any[] } | null> {
    const res = await this.request<any>(
      `/agents/mine?createdBy=${encodeURIComponent(createdBy)}`,
    );
    return res.ok && res.data ? res.data : null;
  }

  async getNotifications(
    userId: string,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<{ unreadCount: number; total: number; items: any[] } | null> {
    const sp = new URLSearchParams();
    if (opts.unreadOnly) sp.set("unreadOnly", "true");
    if (opts.limit) sp.set("limit", String(opts.limit));
    const qs = sp.toString();
    const res = await this.request<any>(
      `/notifications?userId=${encodeURIComponent(userId)}${qs ? `&${qs}` : ""}`,
    );
    return res.ok && res.data ? res.data : null;
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
  }

  async markAllNotificationsRead(userId: string): Promise<{ markedCount: number } | null> {
    const res = await this.request<any>(
      `/notifications/${encodeURIComponent("read-all")}/read?userId=${encodeURIComponent(userId)}`,
      { method: "PUT" },
    );
    return res.ok && res.data ? res.data : null;
  }

  // ──────────────── Skills ────────────────

  async listSkills(params: { keyword?: string; page?: number; pageSize?: number } = {}): Promise<{
    skills: any[];
    total: number;
  } | null> {
    const sp = new URLSearchParams();
    if (params.keyword) sp.set("keyword", params.keyword);
    if (params.page) sp.set("page", String(params.page));
    if (params.pageSize) sp.set("pageSize", String(params.pageSize));
    const qs = sp.toString();
    const res = await this.request<{ skills: any[]; total: number }>(
      `/skills${qs ? `?${qs}` : ""}`,
    );
    if (!res.ok || !res.data) return null;
    return res.data;
  }

  async getSkill(name: string): Promise<any | null> {
    const res = await this.request<any>(`/skills/${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    return res.data;
  }

  async getKnowledgeById(id: string): Promise<any | null> {
    const res = await this.request<any>(`/knowledges/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.data;
  }

  async updateAgent(
    id: string,
    payload: { name?: string; description?: string; prompt?: string; status?: string; avatar?: string },
  ): Promise<any | null> {
    const res = await this.request<any>(`/agents/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return res.ok && res.data ? res.data : null;
  }

  async uploadSkill(zipPath: string, fileBuffer: Buffer, fileName: string): Promise<any | null> {
    const url = `${this.baseUrl}/api/v1/skills`;
    const form = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)]);
    form.append("file", blob, fileName);
    const headers: Record<string, string> = {};
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
    const res = await fetch(url, { method: "POST", body: form, headers });
    const json = (await res.json()) as ApiResponse<any>;
    return json.ok ? json.data : null;
  }

  // ──────────────── Knowledges ────────────────

  async getKnowledge(name: string): Promise<any | null> {
    const res = await this.request<any>(`/knowledges/${encodeURIComponent(name)}`);
    return res.ok ? res.data : null;
  }

  /**
   * 关键字检索知识库（对应 ARM GET /knowledges?search=）。
   * 注意：后端读的是 search 参数（非 keyword）。
   */
  async searchKnowledges(params: { keyword?: string; page?: number; pageSize?: number } = {}): Promise<{ knowledges: any[]; total: number } | null> {
    const sp = new URLSearchParams();
    if (params.keyword) sp.set("search", params.keyword);
    if (params.page) sp.set("page", String(params.page));
    if (params.pageSize) sp.set("pageSize", String(params.pageSize));
    const qs = sp.toString();
    const res = await this.request<{ knowledges: any[]; total: number }>(`/knowledges${qs ? `?${qs}` : ""}`);
    return res.ok ? res.data : null;
  }

  async createKnowledge(payload: { name: string; description?: string; content: string }): Promise<any | null> {
    const res = await this.request<any>(`/knowledges`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.ok ? res.data : null;
  }

  /**
   * 把一个 Knowledge 绑定到 Agent（后续 Run 自动加载这条 knowledge 作为 system prompt 的一部分）。
   * 对应 ARM backend 的 POST /api/v1/agents/:id/knowledges。
   */
  async bindKnowledgeToAgent(
    agentId: string,
    payload: {
      knowledgeId: string;
      version?: string;
      kind?: "essential" | "experience";
      retrievalConfig?: { topK?: number; similarityThreshold?: number };
    },
  ): Promise<{ id: string; knowledgeId: string; version: string } | null> {
    const res = await this.request<any>(
      `/agents/${encodeURIComponent(agentId)}/knowledges`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return res.ok && res.data ? res.data : null;
  }

  // ──────────────── Health ────────────────

  async health(): Promise<boolean> {
    const res = await this.request<any>(`/health`);
    return res.ok;
  }
}

// 模块级：当前请求的 token（由 middleware 注入）
let _currentToken: string | null = null;
export function setArmToken(token: string | null) {
  _currentToken = token;
}

let _arm: ArmClient | null = null;
export function arm(): ArmClient {
  // 每次按当前 token 返回 client（无 token 时用配置默认）
  if (_currentToken) return new ArmClient(undefined, _currentToken);
  if (!_arm) _arm = new ArmClient();
  return _arm;
}