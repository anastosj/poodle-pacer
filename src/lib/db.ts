import Database from "better-sqlite3";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

let sqlite: Database.Database | null = null;
let pg: NeonQueryFunction<false, false> | null = null;
let pgReady: Promise<void> | null = null;

function getSqlite(): Database.Database {
  if (sqlite) return sqlite;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  sqlite = new Database(path.join(dir, "poodle-pacer.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`CREATE TABLE IF NOT EXISTS runner_state (
    runner TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  return sqlite;
}

function getPg(): NeonQueryFunction<false, false> {
  if (!pg) {
    pg = neon(process.env.DATABASE_URL as string, {
      fetchOptions: { cache: "no-store" },
    });
    pgReady = pg`CREATE TABLE IF NOT EXISTS runner_state (
      runner TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`.then(() => undefined);
  }
  return pg;
}

export async function readRunnerState(runner: string): Promise<unknown> {
  if (process.env.DATABASE_URL) {
    const sql = getPg();
    await pgReady;
    const rows = (await sql`SELECT data FROM runner_state WHERE runner = ${runner}`) as {
      data: string;
    }[];
    if (rows.length === 0) return null;
    try {
      return JSON.parse(rows[0].data);
    } catch {
      return null;
    }
  }
  const row = getSqlite()
    .prepare("SELECT data FROM runner_state WHERE runner = ?")
    .get(runner) as { data: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export async function writeRunnerState(
  runner: string,
  state: unknown
): Promise<void> {
  const data = JSON.stringify(state);
  const now = new Date().toISOString();
  if (process.env.DATABASE_URL) {
    const sql = getPg();
    await pgReady;
    await sql`INSERT INTO runner_state (runner, data, updated_at) VALUES (${runner}, ${data}, ${now})
      ON CONFLICT(runner) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`;
    return;
  }
  getSqlite()
    .prepare(
      `INSERT INTO runner_state (runner, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(runner) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
    .run(runner, data, now);
}
