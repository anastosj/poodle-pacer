import Database from "better-sqlite3";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

let sqlite: Database.Database | null = null;
let pg: NeonQueryFunction<false, false> | null = null;
let pgReady: Promise<void> | null = null;

const usingPg = () => Boolean(process.env.DATABASE_URL);

function getSqlite(): Database.Database {
  if (sqlite) return sqlite;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  sqlite = new Database(path.join(dir, "poodle-pacer.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      strava_athlete_id TEXT NOT NULL UNIQUE,
      name TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS strava_tokens (
      user_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scope TEXT,
      athlete_name TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return sqlite;
}

function getPg(): NeonQueryFunction<false, false> {
  if (!pg) {
    pg = neon(process.env.DATABASE_URL as string, {
      fetchOptions: { cache: "no-store" },
    });
    const sql = pg;
    // Neon's tagged template runs one statement per call, so chain the DDL.
    pgReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        strava_athlete_id TEXT NOT NULL UNIQUE,
        name TEXT,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS strava_tokens (
        user_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        scope TEXT,
        athlete_name TEXT,
        updated_at TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS user_state (
        user_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`;
    })();
  }
  return pg;
}

async function ready() {
  if (usingPg()) {
    getPg();
    await pgReady;
  } else {
    getSqlite();
  }
}

/* ------------------------------- users ---------------------------------- */

export interface UserRecord {
  id: string;
  stravaAthleteId: string;
  name: string | null;
  avatarUrl: string | null;
}

interface UserRow {
  id: string;
  strava_athlete_id: string;
  name: string | null;
  avatar_url: string | null;
}

const toUser = (row: UserRow): UserRecord => ({
  id: row.id,
  stravaAthleteId: row.strava_athlete_id,
  name: row.name,
  avatarUrl: row.avatar_url,
});

/** Create the user on first Strava login, or refresh their profile on return. */
export async function upsertStravaUser(input: {
  stravaAthleteId: string;
  name: string | null;
  avatarUrl: string | null;
}): Promise<UserRecord> {
  await ready();
  const id = `strava:${input.stravaAthleteId}`;
  const now = new Date().toISOString();

  if (usingPg()) {
    const sql = getPg();
    await sql`INSERT INTO users (id, strava_athlete_id, name, avatar_url, created_at, last_login_at)
      VALUES (${id}, ${input.stravaAthleteId}, ${input.name}, ${input.avatarUrl}, ${now}, ${now})
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        last_login_at = excluded.last_login_at`;
  } else {
    getSqlite()
      .prepare(
        `INSERT INTO users (id, strava_athlete_id, name, avatar_url, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           avatar_url = excluded.avatar_url,
           last_login_at = excluded.last_login_at`
      )
      .run(id, input.stravaAthleteId, input.name, input.avatarUrl, now, now);
  }

  return {
    id,
    stravaAthleteId: input.stravaAthleteId,
    name: input.name,
    avatarUrl: input.avatarUrl,
  };
}

export async function findUser(id: string): Promise<UserRecord | null> {
  await ready();
  if (usingPg()) {
    const sql = getPg();
    const rows = (await sql`SELECT id, strava_athlete_id, name, avatar_url
      FROM users WHERE id = ${id}`) as UserRow[];
    return rows.length > 0 ? toUser(rows[0]) : null;
  }
  const row = getSqlite()
    .prepare(
      "SELECT id, strava_athlete_id, name, avatar_url FROM users WHERE id = ?"
    )
    .get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/* ---------------------------- strava tokens ------------------------------ */

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  scope: string | null;
  athleteName: string | null;
}

interface TokenRow {
  access_token: string;
  refresh_token: string;
  expires_at: number | string;
  scope: string | null;
  athlete_name: string | null;
}

export async function saveStravaTokens(
  userId: string,
  tokens: StoredTokens
): Promise<void> {
  await ready();
  const now = new Date().toISOString();
  if (usingPg()) {
    const sql = getPg();
    await sql`INSERT INTO strava_tokens (user_id, access_token, refresh_token, expires_at, scope, athlete_name, updated_at)
      VALUES (${userId}, ${tokens.accessToken}, ${tokens.refreshToken}, ${tokens.expiresAt}, ${tokens.scope}, ${tokens.athleteName}, ${now})
      ON CONFLICT(user_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        scope = excluded.scope,
        athlete_name = excluded.athlete_name,
        updated_at = excluded.updated_at`;
    return;
  }
  getSqlite()
    .prepare(
      `INSERT INTO strava_tokens (user_id, access_token, refresh_token, expires_at, scope, athlete_name, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         scope = excluded.scope,
         athlete_name = excluded.athlete_name,
         updated_at = excluded.updated_at`
    )
    .run(
      userId,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
      tokens.scope,
      tokens.athleteName,
      now
    );
}

export async function loadStravaTokens(
  userId: string
): Promise<StoredTokens | null> {
  await ready();
  let row: TokenRow | undefined;
  if (usingPg()) {
    const sql = getPg();
    const rows = (await sql`SELECT access_token, refresh_token, expires_at, scope, athlete_name
      FROM strava_tokens WHERE user_id = ${userId}`) as TokenRow[];
    row = rows[0];
  } else {
    row = getSqlite()
      .prepare(
        `SELECT access_token, refresh_token, expires_at, scope, athlete_name
         FROM strava_tokens WHERE user_id = ?`
      )
      .get(userId) as TokenRow | undefined;
  }
  if (!row) return null;
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: Number(row.expires_at),
    scope: row.scope,
    athleteName: row.athlete_name,
  };
}

export async function deleteStravaTokens(userId: string): Promise<void> {
  await ready();
  if (usingPg()) {
    const sql = getPg();
    await sql`DELETE FROM strava_tokens WHERE user_id = ${userId}`;
    return;
  }
  getSqlite().prepare("DELETE FROM strava_tokens WHERE user_id = ?").run(userId);
}

/* ----------------------------- plan state -------------------------------- */

export async function readUserState(userId: string): Promise<unknown> {
  await ready();
  let data: string | undefined;
  if (usingPg()) {
    const sql = getPg();
    const rows = (await sql`SELECT data FROM user_state WHERE user_id = ${userId}`) as {
      data: string;
    }[];
    data = rows[0]?.data;
  } else {
    const row = getSqlite()
      .prepare("SELECT data FROM user_state WHERE user_id = ?")
      .get(userId) as { data: string } | undefined;
    data = row?.data;
  }
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writeUserState(
  userId: string,
  state: unknown
): Promise<void> {
  await ready();
  const data = JSON.stringify(state);
  const now = new Date().toISOString();
  if (usingPg()) {
    const sql = getPg();
    await sql`INSERT INTO user_state (user_id, data, updated_at) VALUES (${userId}, ${data}, ${now})
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`;
    return;
  }
  getSqlite()
    .prepare(
      `INSERT INTO user_state (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
    .run(userId, data, now);
}
