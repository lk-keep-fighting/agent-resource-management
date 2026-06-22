import { getDb, closeDb } from "./sqlite.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ws_workspace (
  id              TEXT PRIMARY KEY,
  user_id         TEXT,                  -- 所属用户（MVP: 隔离数据）
  agent_id        TEXT NOT NULL,
  agent_version   TEXT,
  agent_name      TEXT,
  agent_avatar    TEXT,
  name            TEXT NOT NULL,
  context         TEXT,
  settings_json   TEXT,
  enable_tools    INTEGER NOT NULL DEFAULT 0,
  cwd             TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  last_active_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ws_workspace_user ON ws_workspace(user_id);
CREATE INDEX IF NOT EXISTS idx_ws_workspace_agent ON ws_workspace(agent_id);
CREATE INDEX IF NOT EXISTS idx_ws_workspace_active ON ws_workspace(last_active_at DESC);

CREATE TABLE IF NOT EXISTS ws_run (
  id                      TEXT PRIMARY KEY,
  workspace_id            TEXT NOT NULL,
  agent_id                TEXT NOT NULL,
  agent_version           TEXT NOT NULL,
  title                   TEXT,
  status                  TEXT NOT NULL,
  system_prompt           TEXT NOT NULL,
  tools_snapshot_json     TEXT,
  skill_bindings_json     TEXT,
  knowledge_bindings_json TEXT,
  duration_ms             INTEGER,
  ttft_ms                 INTEGER,
  prompt_tokens           INTEGER,
  completion_tokens       INTEGER,
  tool_call_count         INTEGER DEFAULT 0,
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES ws_workspace(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ws_run_workspace ON ws_run(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ws_run_agent ON ws_run(agent_id);

CREATE TABLE IF NOT EXISTS ws_message (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  seq             INTEGER NOT NULL,
  role            TEXT NOT NULL,
  content         TEXT,
  tool_call_id    TEXT,
  tool_name       TEXT,
  created_at      INTEGER NOT NULL,
  UNIQUE(run_id, seq),
  FOREIGN KEY (run_id) REFERENCES ws_run(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ws_message_run ON ws_message(run_id, seq);

CREATE TABLE IF NOT EXISTS ws_event (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  seq             INTEGER NOT NULL,
  type            TEXT NOT NULL,
  payload_json    TEXT,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES ws_run(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ws_event_run ON ws_event(run_id, seq);

CREATE TABLE IF NOT EXISTS ws_asset_share (
  id              TEXT PRIMARY KEY,
  from_run_id     TEXT NOT NULL,
  asset_type      TEXT NOT NULL,
  arm_asset_id    TEXT,
  arm_asset_name  TEXT,
  status          TEXT NOT NULL,
  error_message   TEXT,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (from_run_id) REFERENCES ws_run(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ws_asset_share_run ON ws_asset_share(from_run_id);

CREATE TABLE IF NOT EXISTS ws_config (
  key             TEXT PRIMARY KEY,
  value           TEXT,
  updated_at      INTEGER NOT NULL
);
`;

export function runMigrations(): void {
  const db = getDb();
  db.exec(SCHEMA);
  // 幂等增量：给老库加列
  const cols = db
    .query<{ name: string }, []>(`PRAGMA table_info(ws_workspace)`)
    .all();
  if (!cols.some((c) => c.name === "enable_tools")) {
    db.exec(`ALTER TABLE ws_workspace ADD COLUMN enable_tools INTEGER NOT NULL DEFAULT 0`);
    console.log("[migrate] ws_workspace.enable_tools 已添加");
  }
  if (!cols.some((c) => c.name === "cwd")) {
    db.exec(`ALTER TABLE ws_workspace ADD COLUMN cwd TEXT`);
    console.log("[migrate] ws_workspace.cwd 已添加");
  }
  if (!cols.some((c) => c.name === "user_id")) {
    db.exec(`ALTER TABLE ws_workspace ADD COLUMN user_id TEXT`);
    console.log("[migrate] ws_workspace.user_id 已添加");
  }
  // 索引
  const idx = db
    .query<{ name: string }, []>(`PRAGMA index_list(ws_workspace)`)
    .all();
  if (!idx.some((i) => i.name === "idx_ws_workspace_user")) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ws_workspace_user ON ws_workspace(user_id)`);
    console.log("[migrate] idx_ws_workspace_user 已添加");
  }
}

if (import.meta.main) {
  console.log("[migrate] running migrations...");
  runMigrations();
  closeDb();
  console.log("[migrate] done.");
}