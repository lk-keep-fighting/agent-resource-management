export interface Skill {
  id: string;
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];

  fileSize: number;
  fileHash: string;

  publishedAt: string;
  publishedBy: string;
  updatedAt: string;

  downloadCount: number;

  status: 'active' | 'draft' | 'deleted';
}

export interface User {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  msg: string;
}

export interface SkillListQuery {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface SkillListResponse {
  skills: Skill[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LoginRequest {
  apiKey: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}