import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "poodle-pacer.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS runner_state (
    runner TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  return db;
}

export function readRunnerState(runner: string): unknown {
  const row = getDb()
    .prepare("SELECT data FROM runner_state WHERE runner = ?")
    .get(runner) as { data: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export function writeRunnerState(runner: string, state: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO runner_state (runner, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(runner) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
    .run(runner, JSON.stringify(state), new Date().toISOString());
}
