import { getDb } from "../sqlite.ts";

export const configRepo = {
  get(key: string): string | null {
    const row = getDb()
      .prepare(`SELECT value FROM ws_config WHERE key = ?`)
      .get(key) as { value: string | null } | undefined;
    return row?.value ?? null;
  },

  set(key: string, value: string): void {
    getDb()
      .prepare(
        `INSERT INTO ws_config (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, Date.now());
  },

  all(): Record<string, string> {
    const rows = getDb()
      .prepare(`SELECT key, value FROM ws_config`)
      .all() as Array<{ key: string; value: string | null }>;
    const out: Record<string, string> = {};
    for (const r of rows) {
      if (r.value !== null) out[r.key] = r.value;
    }
    return out;
  },
};