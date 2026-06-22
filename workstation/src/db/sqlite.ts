import { Database, type Database as DbType } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "../config.ts";

let _db: DbType | null = null;

export function getDb(): DbType {
  if (_db) return _db;
  const dbPath = resolve(process.cwd(), config.db.path);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  _db = db;
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}