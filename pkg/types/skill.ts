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

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  user: User;
  token: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  prompt: string;
  avatar?: string;
  version: string;
  status: 'active' | 'draft';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  skillsCount?: number;
  knowledgesCount?: number;
  skills?: Array<{
    skillId: string;
    skill: {
      id: string;
      name: string;
      description: string;
      allowedTools?: string[];
    };
    config?: Record<string, unknown>;
  }>;
  knowledges?: Array<{
    knowledgeId: string;
    retrievalConfig?: {
      topK?: number;
      similarityThreshold?: number;
    };
  }>;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
  page: number;
  pageSize: number;
}