import { v4 as uuidv4 } from "uuid";
import { getDb } from "../sqlite.ts";
import type { WsWorkspace } from "../../types.ts";

interface WorkspaceRow {
  id: string;
  user_id: string | null;
  agent_id: string;
  agent_version: string | null;
  agent_name: string | null;
  agent_avatar: string | null;
  name: string;
  context: string | null;
  settings_json: string | null;
  enable_tools: number | null;
  cwd: string | null;
  created_at: number;
  updated_at: number;
  last_active_at: number | null;
}

function rowToWs(row: WorkspaceRow): WsWorkspace {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    agentVersion: row.agent_version,
    agentName: row.agent_name,
    agentAvatar: row.agent_avatar,
    name: row.name,
    context: row.context,
    settings: row.settings_json ? JSON.parse(row.settings_json) : null,
    enableTools: row.enable_tools === 1,
    cwd: row.cwd,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
  };
}

export const workspaceRepo = {
  list(userId?: string | null): WsWorkspace[] {
    if (userId) {
      const rows = getDb()
        .prepare(
          `SELECT * FROM ws_workspace WHERE user_id = ? ORDER BY COALESCE(last_active_at, updated_at) DESC`,
        )
        .all(userId) as WorkspaceRow[];
      return rows.map(rowToWs);
    }
    const rows = getDb()
      .prepare(
        `SELECT * FROM ws_workspace ORDER BY COALESCE(last_active_at, updated_at) DESC`,
      )
      .all() as WorkspaceRow[];
    return rows.map(rowToWs);
  },

  listByAgent(agentId: string, userId?: string | null): WsWorkspace[] {
    if (userId) {
      const rows = getDb()
        .prepare(
          `SELECT * FROM ws_workspace WHERE agent_id = ? AND user_id = ? ORDER BY COALESCE(last_active_at, updated_at) DESC`,
        )
        .all(agentId, userId) as WorkspaceRow[];
      return rows.map(rowToWs);
    }
    const rows = getDb()
      .prepare(
        `SELECT * FROM ws_workspace WHERE agent_id = ? ORDER BY COALESCE(last_active_at, updated_at) DESC`,
      )
      .all(agentId) as WorkspaceRow[];
    return rows.map(rowToWs);
  },

  /** 取单个 workspace。userId 必传，不传或越权返回 null（防水平越权） */
  get(id: string, userId?: string | null): WsWorkspace | null {
    const row = userId
      ? (getDb()
          .prepare(`SELECT * FROM ws_workspace WHERE id = ? AND user_id = ?`)
          .get(id, userId) as WorkspaceRow | undefined)
      : (getDb()
          .prepare(`SELECT * FROM ws_workspace WHERE id = ?`)
          .get(id) as WorkspaceRow | undefined);
    return row ? rowToWs(row) : null;
  },

  create(input: {
    userId?: string | null;
    agentId: string;
    agentVersion?: string | null;
    agentName?: string | null;
    agentAvatar?: string | null;
    name: string;
    context?: string | null;
    settings?: Record<string, unknown> | null;
    enableTools?: boolean;
    cwd?: string | null;
  }): WsWorkspace {
    const now = Date.now();
    const ws: WsWorkspace = {
      id: uuidv4(),
      userId: input.userId ?? null,
      agentId: input.agentId,
      agentVersion: input.agentVersion ?? null,
      agentName: input.agentName ?? null,
      agentAvatar: input.agentAvatar ?? null,
      name: input.name,
      context: input.context ?? null,
      settings: input.settings ?? null,
      enableTools: input.enableTools ?? false,
      cwd: input.cwd ?? null,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
    };
    getDb()
      .prepare(
        `INSERT INTO ws_workspace
         (id, user_id, agent_id, agent_version, agent_name, agent_avatar, name, context, settings_json, enable_tools, cwd, created_at, updated_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ws.id,
        ws.userId,
        ws.agentId,
        ws.agentVersion,
        ws.agentName,
        ws.agentAvatar,
        ws.name,
        ws.context,
        ws.settings ? JSON.stringify(ws.settings) : null,
        ws.enableTools ? 1 : 0,
        ws.cwd,
        ws.createdAt,
        ws.updatedAt,
        ws.lastActiveAt,
      );
    return ws;
  },

  update(
    id: string,
    patch: {
      name?: string;
      context?: string;
      settings?: Record<string, unknown> | null;
      enableTools?: boolean;
    },
  ): WsWorkspace | null {
    const current = this.get(id);
    if (!current) return null;
    const next: WsWorkspace = {
      ...current,
      name: patch.name ?? current.name,
      context: patch.context !== undefined ? patch.context : current.context,
      settings: patch.settings !== undefined ? patch.settings : current.settings,
      enableTools: patch.enableTools !== undefined ? patch.enableTools : current.enableTools,
      updatedAt: Date.now(),
    };
    getDb()
      .prepare(
        `UPDATE ws_workspace SET name = ?, context = ?, settings_json = ?, enable_tools = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        next.name,
        next.context,
        next.settings ? JSON.stringify(next.settings) : null,
        next.enableTools ? 1 : 0,
        next.updatedAt,
        id,
      );
    return next;
  },

  touch(id: string): void {
    const now = Date.now();
    getDb()
      .prepare(`UPDATE ws_workspace SET last_active_at = ?, updated_at = ? WHERE id = ?`)
      .run(now, now, id);
  },

  delete(id: string): boolean {
    const info = getDb().prepare(`DELETE FROM ws_workspace WHERE id = ?`).run(id);
    return info.changes > 0;
  },

  countByAgent(agentId: string): number {
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS c FROM ws_workspace WHERE agent_id = ?`)
      .get(agentId) as { c: number };
    return row.c;
  },

  setCwd(id: string, cwd: string): WsWorkspace | null {
    getDb()
      .prepare(`UPDATE ws_workspace SET cwd = ? WHERE id = ?`)
      .run(cwd, id);
    return this.get(id);
  },
};