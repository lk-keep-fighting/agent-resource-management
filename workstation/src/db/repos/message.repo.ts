import { v4 as uuidv4 } from "uuid";
import { getDb } from "../sqlite.ts";
import type { WsMessage } from "../../types.ts";

interface MessageRow {
  id: string;
  run_id: string;
  seq: number;
  role: "user" | "assistant" | "tool" | "system";
  content: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  created_at: number;
}

function rowToWs(row: MessageRow): WsMessage {
  return {
    id: row.id,
    runId: row.run_id,
    seq: row.seq,
    role: row.role,
    content: row.content,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    createdAt: row.created_at,
  };
}

export const messageRepo = {
  listByRun(runId: string): WsMessage[] {
    const rows = getDb()
      .prepare(`SELECT * FROM ws_message WHERE run_id = ? ORDER BY seq ASC`)
      .all(runId) as MessageRow[];
    return rows.map(rowToWs);
  },

  nextSeq(runId: string): number {
    const row = getDb()
      .prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM ws_message WHERE run_id = ?`)
      .get(runId) as { next: number };
    return row.next;
  },

  append(input: {
    runId: string;
    role: "user" | "assistant" | "tool" | "system";
    content?: string | null;
    toolCallId?: string | null;
    toolName?: string | null;
    seq?: number;
  }): WsMessage {
    const seq = input.seq ?? this.nextSeq(input.runId);
    const msg: WsMessage = {
      id: uuidv4(),
      runId: input.runId,
      seq,
      role: input.role,
      content: input.content ?? null,
      toolCallId: input.toolCallId ?? null,
      toolName: input.toolName ?? null,
      createdAt: Date.now(),
    };
    getDb()
      .prepare(
        `INSERT INTO ws_message (id, run_id, seq, role, content, tool_call_id, tool_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(msg.id, msg.runId, msg.seq, msg.role, msg.content, msg.toolCallId, msg.toolName, msg.createdAt);
    return msg;
  },

  upsertByToolCall(
    runId: string,
    toolCallId: string,
    role: "tool",
    content: string,
    toolName?: string,
  ): WsMessage {
    const existing = getDb()
      .prepare(`SELECT * FROM ws_message WHERE run_id = ? AND tool_call_id = ?`)
      .get(runId, toolCallId) as MessageRow | undefined;
    if (existing) {
      getDb()
        .prepare(`UPDATE ws_message SET content = ?, tool_name = ? WHERE id = ?`)
        .run(content, toolName ?? existing.tool_name, existing.id);
      return rowToWs({ ...existing, content, tool_name: toolName ?? existing.tool_name });
    }
    return this.append({ runId, role, content, toolCallId, toolName });
  },
};