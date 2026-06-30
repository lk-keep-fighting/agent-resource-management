import { v4 as uuidv4 } from "uuid";
import { getDb } from "../sqlite.ts";
import type { WsAssetShare } from "../../types.ts";

interface AssetShareRow {
  id: string;
  from_run_id: string;
  asset_type: "knowledge" | "agent";
  arm_asset_id: string | null;
  arm_asset_name: string | null;
  status: "pending" | "created" | "failed";
  error_message: string | null;
  created_at: number;
}

function rowToWs(row: AssetShareRow): WsAssetShare {
  return {
    id: row.id,
    fromRunId: row.from_run_id,
    assetType: row.asset_type,
    armAssetId: row.arm_asset_id,
    armAssetName: row.arm_asset_name,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export const assetShareRepo = {
  list(): WsAssetShare[] {
    const rows = getDb()
      .prepare(`SELECT * FROM ws_asset_share ORDER BY created_at DESC`)
      .all() as AssetShareRow[];
    return rows.map(rowToWs);
  },

  listByRun(runId: string): WsAssetShare[] {
    const rows = getDb()
      .prepare(`SELECT * FROM ws_asset_share WHERE from_run_id = ? ORDER BY created_at DESC`)
      .all(runId) as AssetShareRow[];
    return rows.map(rowToWs);
  },

  create(input: { fromRunId: string; assetType: "knowledge" | "agent" }): WsAssetShare {
    const id = uuidv4();
    getDb()
      .prepare(
        `INSERT INTO ws_asset_share (id, from_run_id, asset_type, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`,
      )
      .run(id, input.fromRunId, input.assetType, Date.now());
    return this.get(id)!;
  },

  get(id: string): WsAssetShare | null {
    const row = getDb()
      .prepare(`SELECT * FROM ws_asset_share WHERE id = ?`)
      .get(id) as AssetShareRow | undefined;
    return row ? rowToWs(row) : null;
  },

  markCreated(id: string, armAssetId: string, armAssetName: string): void {
    getDb()
      .prepare(
        `UPDATE ws_asset_share SET status = 'created', arm_asset_id = ?, arm_asset_name = ? WHERE id = ?`,
      )
      .run(armAssetId, armAssetName, id);
  },

  markFailed(id: string, errorMessage: string): void {
    getDb()
      .prepare(
        `UPDATE ws_asset_share SET status = 'failed', error_message = ? WHERE id = ?`,
      )
      .run(errorMessage, id);
  },
};