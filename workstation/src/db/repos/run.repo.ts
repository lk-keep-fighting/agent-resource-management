import { v4 as uuidv4 } from "uuid";
import { getDb } from "../sqlite.ts";
import type { WsRun, RunStatus } from "../../types.ts";

interface RunRow {
  id: string;
  workspace_id: string;
  agent_id: string;
  agent_version: string;
  title: string | null;
  status: RunStatus;
  system_prompt: string;
  tools_snapshot_json: string | null;
  skill_bindings_json: string | null;
  knowledge_bindings_json: string | null;
  duration_ms: number | null;
  ttft_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  tool_call_count: number;
  created_at: number;
  updated_at: number;
}

function rowToWs(row: RunRow): WsRun {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    agentVersion: row.agent_version,
    title: row.title,
    status: row.status,
    systemPrompt: row.system_prompt,
    toolsSnapshot: row.tools_snapshot_json ? JSON.parse(row.tools_snapshot_json) : null,
    skillBindings: row.skill_bindings_json ? JSON.parse(row.skill_bindings_json) : null,
    knowledgeBindings: row.knowledge_bindings_json ? JSON.parse(row.knowledge_bindings_json) : null,
    durationMs: row.duration_ms,
    ttftMs: row.ttft_ms,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    toolCallCount: row.tool_call_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const runRepo = {
  get(id: string): WsRun | null {
    const row = getDb()
      .prepare(`SELECT * FROM ws_run WHERE id = ?`)
      .get(id) as RunRow | undefined;
    return row ? rowToWs(row) : null;
  },

  /** 列某 workspace 的 run。userId 必传用于防越权（仅当 workspace 属于该 user） */
  listByWorkspace(workspaceId: string, limit = 50, userId?: string | null): WsRun[] {
    const rows = userId
      ? (getDb()
          .prepare(
            `SELECT r.* FROM ws_run r
             INNER JOIN ws_workspace w ON w.id = r.workspace_id
             WHERE r.workspace_id = ? AND w.user_id = ?
             ORDER BY r.created_at DESC LIMIT ?`,
          )
          .all(workspaceId, userId, limit) as RunRow[])
      : (getDb()
          .prepare(
            `SELECT * FROM ws_run WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`,
          )
          .all(workspaceId, limit) as RunRow[]);
    return rows.map(rowToWs);
  },

  listByAgent(agentId: string, limit = 50): WsRun[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM ws_run WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(agentId, limit) as RunRow[];
    return rows.map(rowToWs);
  },

  create(input: {
    workspaceId: string;
    agentId: string;
    agentVersion: string;
    systemPrompt: string;
    toolsSnapshot?: Array<{ name: string; description: string }> | null;
    skillBindings?: unknown[] | null;
    knowledgeBindings?: unknown[] | null;
    title?: string | null;
  }): WsRun {
    const now = Date.now();
    const run: WsRun = {
      id: uuidv4(),
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      agentVersion: input.agentVersion,
      title: input.title ?? null,
      status: "created",
      systemPrompt: input.systemPrompt,
      toolsSnapshot: input.toolsSnapshot ?? null,
      skillBindings: input.skillBindings ?? null,
      knowledgeBindings: input.knowledgeBindings ?? null,
      durationMs: null,
      ttftMs: null,
      promptTokens: null,
      completionTokens: null,
      toolCallCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    getDb()
      .prepare(
        `INSERT INTO ws_run
         (id, workspace_id, agent_id, agent_version, title, status, system_prompt,
          tools_snapshot_json, skill_bindings_json, knowledge_bindings_json,
          duration_ms, ttft_ms, prompt_tokens, completion_tokens, tool_call_count,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.id,
        run.workspaceId,
        run.agentId,
        run.agentVersion,
        run.title,
        run.status,
        run.systemPrompt,
        run.toolsSnapshot ? JSON.stringify(run.toolsSnapshot) : null,
        run.skillBindings ? JSON.stringify(run.skillBindings) : null,
        run.knowledgeBindings ? JSON.stringify(run.knowledgeBindings) : null,
        run.durationMs,
        run.ttftMs,
        run.promptTokens,
        run.completionTokens,
        run.toolCallCount,
        run.createdAt,
        run.updatedAt,
      );
    return run;
  },

  updateStatus(id: string, status: RunStatus): void {
    getDb()
      .prepare(`UPDATE ws_run SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, Date.now(), id);
  },

  updateTitle(id: string, title: string): void {
    getDb()
      .prepare(`UPDATE ws_run SET title = ?, updated_at = ? WHERE id = ?`)
      .run(title, Date.now(), id);
  },

  /** 用于"我的历史"：列出当前用户最近 N 条 run（JOIN ws_workspace 取 agentName） */
  listAllRecent(limit = 50, userId?: string | null): Array<{
    id: string;
    agentId: string;
    agentName: string | null;
    title: string | null;
    status: RunStatus;
    createdAt: number;
  }> {
    const rows = userId
      ? (getDb()
          .prepare(
            `SELECT r.id, r.agent_id, w.agent_name, r.title, r.status, r.created_at
             FROM ws_run r
             LEFT JOIN ws_workspace w ON w.id = r.workspace_id
             WHERE w.user_id = ?
             ORDER BY r.created_at DESC LIMIT ?`,
          )
          .all(userId, limit) as Array<{
            id: string;
            agent_id: string;
            agent_name: string | null;
            title: string | null;
            status: RunStatus;
            created_at: number;
          }>)
      : (getDb()
          .prepare(
            `SELECT r.id, r.agent_id, w.agent_name, r.title, r.status, r.created_at
             FROM ws_run r
             LEFT JOIN ws_workspace w ON w.id = r.workspace_id
             ORDER BY r.created_at DESC LIMIT ?`,
          )
          .all(limit) as Array<{
            id: string;
            agent_id: string;
            agent_name: string | null;
            title: string | null;
            status: RunStatus;
            created_at: number;
          }>);
    return rows.map((r) => ({
      id: r.id,
      agentId: r.agent_id,
      agentName: r.agent_name,
      title: r.title,
      status: r.status,
      createdAt: r.created_at,
    }));
  },

  recordMetrics(
    id: string,
    metrics: {
      durationMs?: number | null;
      ttftMs?: number | null;
      promptTokens?: number | null;
      completionTokens?: number | null;
      toolCallCount?: number | null;
    },
  ): void {
    const cur = this.get(id);
    if (!cur) return;
    getDb()
      .prepare(
        `UPDATE ws_run
         SET duration_ms = ?, ttft_ms = ?, prompt_tokens = ?, completion_tokens = ?, tool_call_count = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        metrics.durationMs ?? cur.durationMs,
        metrics.ttftMs ?? cur.ttftMs,
        metrics.promptTokens ?? cur.promptTokens,
        metrics.completionTokens ?? cur.completionTokens,
        metrics.toolCallCount ?? cur.toolCallCount,
        Date.now(),
        id,
      );
  },
};