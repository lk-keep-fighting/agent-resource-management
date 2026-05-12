import type { User, Skill, SkillListResponse, ApiResponse, LoginResponse, RegisterResponse, Agent, AgentListResponse } from '@pkg/types/skill';

export class ApiClient {
  private token: string | null = null;
  private serverUrl: string;

  constructor(serverUrl: string, token?: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.token = token || null;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.serverUrl}/api/v1${path}`, {
      ...options,
      headers,
    });

    return res.json();
  }

  async login(apiKey: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async register(email: string, password: string, name: string): Promise<RegisterResponse> {
    const res = await this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async me(): Promise<User> {
    const res = await this.request<User>('/auth/me');
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async listSkills(keyword?: string, page = 1, pageSize = 20): Promise<SkillListResponse> {
    let path = `/skills?page=${page}&pageSize=${pageSize}`;
    if (keyword) {
      path += `&keyword=${encodeURIComponent(keyword)}`;
    }
    const res = await this.request<SkillListResponse>(path);
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async getSkill(name: string): Promise<Skill> {
    const res = await this.request<Skill>(`/skills/${name}`);
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async getMySkills(): Promise<Skill[]> {
    const res = await this.request<Skill[]>('/users/me/skills');
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async uploadSkill(filePath: string): Promise<Skill> {
    const { readFileSync } = await import('fs');
    const { basename } = await import('path');
    const fileName = basename(filePath);
    const fileBuffer = readFileSync(filePath);

    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, fileName);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.serverUrl}/api/v1/skills`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json();
    console.error('DEBUG server response:', JSON.stringify(data));
    if (!data.ok) {
      throw new Error(data.msg);
    }
    return data.data;
  }

  async deleteSkill(name: string): Promise<void> {
    const res = await this.request<null>(`/skills/${name}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
  }

  async downloadSkill(name: string): Promise<ArrayBuffer> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.serverUrl}/api/v1/skills/${name}/download`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Skill 不存在');
      }
      throw new Error('下载失败');
    }

    return res.arrayBuffer();
  }

  async listAgents(keyword?: string, page = 1, pageSize = 20): Promise<AgentListResponse> {
    let path = `/agents?page=${page}&pageSize=${pageSize}`;
    if (keyword) {
      path += `&keyword=${encodeURIComponent(keyword)}`;
    }
    const res = await this.request<AgentListResponse>(path);
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async getAgent(id: string): Promise<Agent> {
    const res = await this.request<Agent>(`/agents/${id}`);
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async downloadAgent(id: string): Promise<{ buffer: ArrayBuffer; version: string }> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.serverUrl}/api/v1/agents/${id}/download`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Agent 不存在');
      }
      throw new Error('下载失败');
    }

    const version = res.headers.get('X-Version') || 'unknown';
    return {
      buffer: await res.arrayBuffer(),
      version,
    };
  }

  async listKnowledge(keyword?: string, page = 1, pageSize = 20): Promise<{ knowledges: any[]; total: number }> {
    let path = `/knowledges?page=${page}&pageSize=${pageSize}`;
    if (keyword) {
      path += `&keyword=${encodeURIComponent(keyword)}`;
    }
    const res = await this.request<{ knowledges: any[]; total: number }>(path);
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async getKnowledge(name: string): Promise<any> {
    const res = await this.request<any>(`/knowledges/${name}`);
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async getMyKnowledge(): Promise<any[]> {
    const res = await this.request<any[]>('/users/me/knowledges');
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async uploadKnowledge(filePath: string): Promise<any> {
    const { readFileSync } = await import('fs');
    const { basename } = await import('path');
    const fileName = basename(filePath);
    const fileBuffer = readFileSync(filePath);

    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, fileName);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.serverUrl}/api/v1/knowledges`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.msg);
    }
    return data.data;
  }

  async deleteKnowledge(name: string): Promise<void> {
    const res = await this.request<null>(`/knowledges/${name}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
  }

  async downloadKnowledge(name: string): Promise<ArrayBuffer> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.serverUrl}/api/v1/knowledges/${name}/download`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Knowledge 不存在');
      }
      throw new Error('下载失败');
    }

    return res.arrayBuffer();
  }

  async createAgent(data: {
    name: string;
    description?: string;
    prompt?: string;
    avatar?: string;
    skills?: Array<{ skillId: string; config?: Record<string, unknown> }>;
    knowledges?: Array<{ knowledgeId: string; retrievalConfig?: { topK?: number; similarityThreshold?: number } }>;
  }): Promise<Agent> {
    const res = await this.request<Agent>('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async updateAgent(id: string, data: Partial<{
    name: string;
    description: string;
    prompt: string;
    avatar: string;
    status: 'active' | 'draft';
  }>): Promise<Agent> {
    const res = await this.request<Agent>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
    return res.data;
  }

  async deleteAgent(id: string): Promise<void> {
    const res = await this.request<null>(`/agents/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
  }

  async bindSkillToAgent(agentId: string, skillId: string, config?: Record<string, unknown>): Promise<void> {
    const res = await this.request<null>(`/agents/${agentId}/skills`, {
      method: 'POST',
      body: JSON.stringify({ skillId, config }),
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
  }

  async unbindSkillFromAgent(agentId: string, skillId: string): Promise<void> {
    const res = await this.request<null>(`/agents/${agentId}/skills?skillId=${skillId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
  }

  async bindKnowledgeToAgent(agentId: string, knowledgeId: string, retrievalConfig?: { topK?: number; similarityThreshold?: number }): Promise<void> {
    const res = await this.request<null>(`/agents/${agentId}/knowledges`, {
      method: 'POST',
      body: JSON.stringify({ knowledgeId, retrievalConfig }),
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
  }

  async unbindKnowledgeFromAgent(agentId: string, knowledgeId: string): Promise<void> {
    const res = await this.request<null>(`/agents/${agentId}/knowledges?knowledgeId=${knowledgeId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(res.msg);
    }
  }

  async getAgentByName(name: string): Promise<Agent | null> {
    const result = await this.listAgents(name, 1, 1);
    return result.agents.find(a => a.name === name) || null;
  }
}