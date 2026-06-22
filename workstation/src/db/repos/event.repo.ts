import { v4 as uuidv4 } from "uuid";
import { getDb } from "../sqlite.ts";
import type { WsEvent } from "../../types.ts";

interface EventRow {
  id: string;
  run_id: string;
  seq: number;
  type: string;
  payload_json: string | null;
  created_at: number;
}

function rowToWs(row: EventRow): WsEvent {
  return {
    id: row.id,
    runId: row.run_id,
    seq: row.seq,
    type: row.type,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    createdAt: row.created_at,
  };
}

export const eventRepo = {
  listByRun(runId: string): WsEvent[] {
    const rows = getDb()
      .prepare(`SELECT * FROM ws_event WHERE run_id = ? ORDER BY seq ASC`)
      .all(runId) as EventRow[];
    return rows.map(rowToWs);
  },

  append(input: {
    runId: string;
    type: string;
    payload?: Record<string, unknown> | null;
    seq?: number;
  }): WsEvent {
    const row = getDb()
      .prepare(
        `INSERT INTO ws_event (id, run_id, seq, type, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv4(),
        input.runId,
        input.seq ?? 0,
        input.type,
        input.payload ? JSON.stringify(input.payload) : null,
        Date.now(),
      );
    return {
      id: String(row.lastInsertRowid),
      runId: input.runId,
      seq: input.seq ?? 0,
      type: input.type,
      payload: input.payload ?? null,
      createdAt: Date.now(),
    };
  },

  nextSeq(runId: string): number {
    const row = getDb()
      .prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM ws_event WHERE run_id = ?`)
      .get(runId) as { next: number };
    return row.next;
  },
};