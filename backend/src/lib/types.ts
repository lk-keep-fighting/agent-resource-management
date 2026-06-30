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
  role: string;
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

export interface PasswordLoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginResponse {
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
    skill: Skill;
    config?: Record<string, unknown>;
  }>;
  knowledges?: Array<{
    knowledgeId: string;
    kind?: "essential" | "experience";
    retrievalConfig?: {
      topK?: number;
      similarityThreshold?: number;
    };
  }>;
}

export interface AgentSkill {
  skillId: string;
  config?: Record<string, unknown>;
}

export interface AgentKnowledge {
  knowledgeId: string;
  kind?: "essential" | "experience";
  retrievalConfig?: {
    topK?: number;
    similarityThreshold?: number;
  };
}

export interface AgentWithRelations extends Agent {
  skills: Array<{
    skillId: string;
    skill: Skill;
    config?: Record<string, unknown>;
  }>;
  knowledges: Array<{
    knowledgeId: string;
    kind?: "essential" | "experience";
    retrievalConfig?: {
      topK?: number;
      similarityThreshold?: number;
    };
  }>;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  prompt: string;
  skills: Array<{
    id: string;
    name: string;
    description: string;
    allowedTools?: string[];
    config: Record<string, unknown>;
    version: string;
  }>;
  knowledges: Array<{
    id: string;
    kind?: "essential" | "experience";
    retrievalConfig?: {
      topK?: number;
      similarityThreshold?: number;
    };
    version: string;
  }>;
}

export interface AgentListQuery {
  keyword?: string;
  status?: 'active' | 'draft';
  page?: number;
  pageSize?: number;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateAgentRequest {
  name: string;
  description: string;
  prompt: string;
  avatar?: string;
  status?: 'active' | 'draft';
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  prompt?: string;
  avatar?: string;
  status?: 'active' | 'draft';
  version?: string;
}

export interface BindSkillRequest {
  skillId: string;
  config?: Record<string, unknown>;
}

export interface BindKnowledgeRequest {
  knowledgeId: string;
  kind?: "essential" | "experience";
  retrievalConfig?: {
    topK?: number;
    similarityThreshold?: number;
  };
}

export interface Knowledge {
  id: string;
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeListResponse {
  knowledges: Knowledge[];
  total: number;
  page: number;
  pageSize: number;
}