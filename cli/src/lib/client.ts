import type { User, Skill, SkillListResponse, ApiResponse, LoginResponse } from '@pkg/types/skill';

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
}