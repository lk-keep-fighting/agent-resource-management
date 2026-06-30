export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  msg: string;
}

export interface ArmAgent {
  id: string;
  name: string;
  description: string;
  prompt: string;
  avatar?: string;
  version: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  skillsCount?: number;
  knowledgesCount?: number;
}

export interface ArmAgentDetail extends ArmAgent {
  feedbackSummary?: {
    total: number;
    avgRating: number | null;
    helpfulCount: number;
    unhelpfulCount: number;
  } | null;
  skillBindings?: Array<{
    id: string;
    skillId: string;
    skillName?: string;
    version: string;
    config?: Record<string, unknown>;
  }>;
  knowledgeBindings?: Array<{
    id: string;
    knowledgeId: string;
    knowledgeName?: string;
    version: string;
    retrievalConfig?: Record<string, unknown>;
  }>;
}

export interface ArmSkill {
  id: string;
  name: string;
  description: string;
  version?: string;
  status?: string;
  downloadCount?: number;
}

export interface ArmKnowledge {
  id: string;
  name: string;
  description?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WsWorkspace {
  id: string;
  userId: string | null;
  agentId: string;
  agentVersion: string | null;
  agentName: string | null;
  agentAvatar: string | null;
  name: string;
  context: string | null;
  settings: Record<string, unknown> | null;
  enableTools: boolean;
  cwd: string | null;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number | null;
}

export type RunStatus =
  | "created"
  | "loading"
  | "streaming"
  | "tool_calling"
  | "completed"
  | "failed"
  | "aborted";

export interface WsRun {
  id: string;
  workspaceId: string;
  agentId: string;
  agentVersion: string;
  title: string | null;
  status: RunStatus;
  systemPrompt: string;
  toolsSnapshot: Array<{ name: string; description: string }> | null;
  skillBindings: unknown[] | null;
  knowledgeBindings: unknown[] | null;
  durationMs: number | null;
  ttftMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  toolCallCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface WsMessage {
  id: string;
  runId: string;
  seq: number;
  role: "user" | "assistant" | "tool" | "system";
  content: string | null;
  toolCallId: string | null;
  toolName: string | null;
  createdAt: number;
}

export interface WsEvent {
  id: string;
  runId: string;
  seq: number;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: number;
}

export interface WsFeedback {
  id: string;
  runId: string;
  rating: number | null;
  isHelpful: boolean | null;
  comment: string | null;
  tags: string[] | null;
  createdAt: number;
}

export interface WsAssetShare {
  id: string;
  fromRunId: string;
  assetType: "knowledge" | "agent";
  armAssetId: string | null;
  armAssetName: string | null;
  status: "pending" | "created" | "failed";
  errorMessage: string | null;
  createdAt: number;
}