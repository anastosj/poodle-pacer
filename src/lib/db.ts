import Database from "better-sqlite3";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { randomBytes, randomInt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { MAX_STATE_BYTES } from "@/lib/state-limits";
import { activePlan, normalizeState } from "@/lib/store";

let sqlite: Database.Database | null = null;
let pg: NeonQueryFunction<false, false> | null = null;
let pgReady: Promise<void> | null = null;
let migrationReady: Promise<void> | null = null;

const usingPg = () => Boolean(process.env.DATABASE_URL);
const INVITE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function normalizeInviteCode(code: string): string {
  return code.trim().toLowerCase();
}

function newInviteCode(): string {
  return Array.from(
    { length: 10 },
    () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]
  ).join("");
}

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
    CREATE TABLE IF NOT EXISTS sms_sends (
      user_id TEXT NOT NULL,
      send_key TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      PRIMARY KEY (user_id, send_key)
    );
    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS race_members (
      race_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      share_stats INTEGER NOT NULL DEFAULT 1,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (race_id, user_id)
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
      await sql`CREATE TABLE IF NOT EXISTS sms_sends (
        user_id TEXT NOT NULL,
        send_key TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        PRIMARY KEY (user_id, send_key)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS races (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS race_members (
        race_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        share_stats BOOLEAN NOT NULL DEFAULT TRUE,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (race_id, user_id)
      )`;
    })();
  }
  return pg;
}

export interface RaceRecord {
  id: string;
  name: string;
  ownerUserId: string;
  inviteCode: string;
  createdAt: string;
}

export interface RaceMemberRecord {
  raceId: string;
  userId: string;
  planId: string;
  shareStats: boolean;
  joinedAt: string;
}

export interface RaceMemberWithState extends RaceMemberRecord {
  user: UserRecord;
  state: unknown | null;
}

interface RaceRow {
  id: string;
  name: string;
  owner_user_id: string;
  invite_code: string;
  created_at: string;
}

interface MemberRow extends UserRow {
  race_id: string;
  user_id: string;
  plan_id: string;
  share_stats: boolean | number;
  joined_at: string;
  data: string | null;
}

function toRace(row: RaceRow): RaceRecord {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
  };
}

function parseState(data: string | null): unknown | null {
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function migrateExistingData(): Promise<void> {
  const now = new Date().toISOString();
  if (usingPg()) {
    const sql = getPg();
    await sql`SELECT pg_advisory_xact_lock(hashtext('poodle-pacer-family-race'))`;
    const races = (await sql`SELECT id FROM races LIMIT 1`) as { id: string }[];
    if (races.length > 0) return;
    const users = (await sql`SELECT id FROM users ORDER BY created_at ASC`) as { id: string }[];
    if (users.length === 0) return;
    const raceId = "race-family";
    const inviteCode = newInviteCode();
    await sql`INSERT INTO races (id, name, owner_user_id, invite_code, created_at)
      VALUES (${raceId}, ${"The Family"}, ${users[0].id}, ${inviteCode}, ${now})
      ON CONFLICT DO NOTHING`;
    for (const user of users) {
      const states = (await sql`SELECT data FROM user_state WHERE user_id = ${user.id}`) as { data: string }[];
      const state = normalizeState(parseState(states[0]?.data ?? null));
      await sql`INSERT INTO race_members (race_id, user_id, plan_id, share_stats, joined_at)
        VALUES (${raceId}, ${user.id}, ${activePlan(state).id}, TRUE, ${now})
        ON CONFLICT (race_id, user_id) DO NOTHING`;
    }
    return;
  }
  const db = getSqlite();
  const migrate = db.transaction(() => {
    const race = db.prepare("SELECT id FROM races LIMIT 1").get() as { id: string } | undefined;
    if (race) return;
    const users = db.prepare("SELECT id FROM users ORDER BY created_at ASC").all() as { id: string }[];
    if (users.length === 0) return;
    const raceId = "race-family";
    db.prepare(
      "INSERT INTO races (id, name, owner_user_id, invite_code, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING"
    ).run(raceId, "The Family", users[0].id, newInviteCode(), now);
    const planStmt = db.prepare("SELECT data FROM user_state WHERE user_id = ?");
    const memberStmt = db.prepare(
      "INSERT INTO race_members (race_id, user_id, plan_id, share_stats, joined_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(race_id, user_id) DO NOTHING"
    );
    for (const user of users) {
      const row = planStmt.get(user.id) as { data: string } | undefined;
      memberStmt.run(raceId, user.id, activePlan(normalizeState(parseState(row?.data ?? null))).id, now);
    }
  });
  migrate();
}

async function ready() {
  if (usingPg()) {
    getPg();
    await pgReady;
  } else {
    getSqlite();
  }
  if (!migrationReady) migrationReady = migrateExistingData();
  await migrationReady;
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

/* ------------------------------- races ---------------------------------- */

export async function listRacesForUser(userId: string): Promise<RaceRecord[]> {
  await ready();
  if (usingPg()) {
    const sql = getPg();
    const rows = (await sql`SELECT r.id, r.name, r.owner_user_id,
      CASE WHEN r.owner_user_id = ${userId} THEN r.invite_code ELSE '' END AS invite_code,
      r.created_at
      FROM races r INNER JOIN race_members m ON m.race_id = r.id
      WHERE m.user_id = ${userId} ORDER BY r.created_at ASC`) as RaceRow[];
    return rows.map(toRace);
  }
  return (getSqlite().prepare(
    `SELECT r.id, r.name, r.owner_user_id,
     CASE WHEN r.owner_user_id = ? THEN r.invite_code ELSE '' END AS invite_code,
     r.created_at
     FROM races r INNER JOIN race_members m ON m.race_id = r.id
     WHERE m.user_id = ? ORDER BY r.created_at ASC`
  ).all(userId, userId) as RaceRow[]).map(toRace);
}

/** Alerts need each account's own state, not group-facing user data. */
export async function listUsersForAlerts(): Promise<
  { user: UserRecord; state: unknown }[]
> {
  await ready();
  let rows: (UserRow & { data: string | null })[];
  if (usingPg()) {
    rows = (await getPg()`SELECT u.id, u.strava_athlete_id, u.name, u.avatar_url, s.data
      FROM users u LEFT JOIN user_state s ON s.user_id = u.id
      ORDER BY u.created_at ASC`) as (UserRow & { data: string | null })[];
  } else {
    rows = getSqlite().prepare(
      `SELECT u.id, u.strava_athlete_id, u.name, u.avatar_url, s.data
       FROM users u LEFT JOIN user_state s ON s.user_id = u.id
       ORDER BY u.created_at ASC`
    ).all() as (UserRow & { data: string | null })[];
  }
  return rows.map((row) => ({ user: toUser(row), state: parseState(row.data) }));
}

export async function countUserRaces(userId: string): Promise<number> {
  await ready();
  if (usingPg()) {
    const rows = (await getPg()`SELECT COUNT(*)::int AS count FROM race_members WHERE user_id = ${userId}`) as { count: number }[];
    return rows[0]?.count ?? 0;
  }
  return Number((getSqlite().prepare("SELECT COUNT(*) AS count FROM race_members WHERE user_id = ?").get(userId) as { count: number }).count);
}

export async function countRaceMembers(raceId: string): Promise<number> {
  await ready();
  if (usingPg()) {
    const rows = (await getPg()`SELECT COUNT(*)::int AS count FROM race_members WHERE race_id = ${raceId}`) as { count: number }[];
    return rows[0]?.count ?? 0;
  }
  return Number((getSqlite().prepare("SELECT COUNT(*) AS count FROM race_members WHERE race_id = ?").get(raceId) as { count: number }).count);
}

export async function findRaceById(raceId: string): Promise<RaceRecord | null> {
  await ready();
  if (usingPg()) {
    const sql = getPg();
    const rows = (await sql`SELECT id, name, owner_user_id, invite_code, created_at
      FROM races WHERE id = ${raceId}`) as RaceRow[];
    return rows[0] ? toRace(rows[0]) : null;
  }
  const row = getSqlite().prepare(
    "SELECT id, name, owner_user_id, invite_code, created_at FROM races WHERE id = ?"
  ).get(raceId) as RaceRow | undefined;
  return row ? toRace(row) : null;
}

export async function findRaceByInviteCode(code: string): Promise<RaceRecord | null> {
  const normalized = normalizeInviteCode(code);
  await ready();
  if (usingPg()) {
    const sql = getPg();
    const rows = (await sql`SELECT id, name, owner_user_id, invite_code, created_at
      FROM races WHERE invite_code = ${normalized}`) as RaceRow[];
    return rows[0] ? toRace(rows[0]) : null;
  }
  const row = getSqlite().prepare(
    "SELECT id, name, owner_user_id, invite_code, created_at FROM races WHERE invite_code = ?"
  ).get(normalized) as RaceRow | undefined;
  return row ? toRace(row) : null;
}

export async function getRaceMember(
  raceId: string,
  userId: string
): Promise<RaceMemberRecord | null> {
  await ready();
  let row: { race_id: string; user_id: string; plan_id: string; share_stats: boolean | number; joined_at: string } | undefined;
  if (usingPg()) {
    const sql = getPg();
    const rows = (await sql`SELECT race_id, user_id, plan_id, share_stats, joined_at
      FROM race_members WHERE race_id = ${raceId} AND user_id = ${userId}`) as typeof row[];
    row = rows[0];
  } else {
    row = getSqlite().prepare(
      "SELECT race_id, user_id, plan_id, share_stats, joined_at FROM race_members WHERE race_id = ? AND user_id = ?"
    ).get(raceId, userId) as typeof row;
  }
  return row ? {
    raceId: row.race_id,
    userId: row.user_id,
    planId: row.plan_id,
    shareStats: Boolean(row.share_stats),
    joinedAt: row.joined_at,
  } : null;
}

/** Race members only; private plan blobs are omitted when sharing is off. */
export async function listRaceMembersWithState(
  raceId: string,
  requesterUserId: string
): Promise<RaceMemberWithState[] | null> {
  if (!(await getRaceMember(raceId, requesterUserId))) return null;
  await ready();
  let rows: MemberRow[];
  if (usingPg()) {
    const sql = getPg();
    rows = (await sql`SELECT m.race_id, m.user_id, m.plan_id, m.share_stats, m.joined_at,
      u.id, u.strava_athlete_id, u.name, u.avatar_url,
      CASE WHEN m.share_stats THEN s.data ELSE NULL END AS data
      FROM race_members m INNER JOIN users u ON u.id = m.user_id
      LEFT JOIN user_state s ON s.user_id = m.user_id
      WHERE m.race_id = ${raceId} ORDER BY m.joined_at ASC`) as MemberRow[];
  } else {
    rows = getSqlite().prepare(
      `SELECT m.race_id, m.user_id, m.plan_id, m.share_stats, m.joined_at,
       u.id, u.strava_athlete_id, u.name, u.avatar_url,
       CASE WHEN m.share_stats = 1 THEN s.data ELSE NULL END AS data
       FROM race_members m INNER JOIN users u ON u.id = m.user_id
       LEFT JOIN user_state s ON s.user_id = m.user_id
       WHERE m.race_id = ? ORDER BY m.joined_at ASC`
    ).all(raceId) as MemberRow[];
  }
  return rows.map((row) => ({
    raceId: row.race_id,
    userId: row.user_id,
    planId: row.plan_id,
    shareStats: Boolean(row.share_stats),
    joinedAt: row.joined_at,
    user: toUser(row),
    state: row.share_stats ? parseState(row.data) : null,
  }));
}

export async function createRace(
  userId: string,
  name: string,
  planId: string
): Promise<RaceRecord> {
  await ready();
  const id = `race-${randomBytes(12).toString("hex")}`;
  const now = new Date().toISOString();
  const invite = newInviteCode();
  if (usingPg()) {
    const sql = getPg();
    await sql`INSERT INTO races (id, name, owner_user_id, invite_code, created_at)
      VALUES (${id}, ${name}, ${userId}, ${invite}, ${now})`;
    await sql`INSERT INTO race_members (race_id, user_id, plan_id, share_stats, joined_at)
      VALUES (${id}, ${userId}, ${planId}, TRUE, ${now})`;
  } else {
    const db = getSqlite();
    const tx = db.transaction(() => {
      db.prepare("INSERT INTO races (id, name, owner_user_id, invite_code, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(id, name, userId, invite, now);
      db.prepare("INSERT INTO race_members (race_id, user_id, plan_id, share_stats, joined_at) VALUES (?, ?, ?, 1, ?)")
        .run(id, userId, planId, now);
    });
    tx();
  }
  return { id, name, ownerUserId: userId, inviteCode: invite, createdAt: now };
}

export async function joinRace(
  race: RaceRecord,
  userId: string,
  planId: string
): Promise<void> {
  await ready();
  const now = new Date().toISOString();
  if (usingPg()) {
    const sql = getPg();
    await sql`INSERT INTO race_members (race_id, user_id, plan_id, share_stats, joined_at)
      VALUES (${race.id}, ${userId}, ${planId}, TRUE, ${now})
      ON CONFLICT (race_id, user_id) DO NOTHING`;
    return;
  }
  getSqlite().prepare(
    "INSERT INTO race_members (race_id, user_id, plan_id, share_stats, joined_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(race_id, user_id) DO NOTHING"
  ).run(race.id, userId, planId, now);
}

export async function updateRaceMember(
  raceId: string,
  userId: string,
  update: { shareStats?: boolean; planId?: string }
): Promise<void> {
  await ready();
  if (usingPg()) {
    const sql = getPg();
    if (update.shareStats !== undefined && update.planId !== undefined) {
      await sql`UPDATE race_members SET share_stats = ${update.shareStats}, plan_id = ${update.planId}
        WHERE race_id = ${raceId} AND user_id = ${userId}`;
    } else if (update.shareStats !== undefined) {
      await sql`UPDATE race_members SET share_stats = ${update.shareStats}
        WHERE race_id = ${raceId} AND user_id = ${userId}`;
    } else if (update.planId !== undefined) {
      await sql`UPDATE race_members SET plan_id = ${update.planId}
        WHERE race_id = ${raceId} AND user_id = ${userId}`;
    }
    return;
  }
  if (update.shareStats !== undefined && update.planId !== undefined) {
    getSqlite().prepare("UPDATE race_members SET share_stats = ?, plan_id = ? WHERE race_id = ? AND user_id = ?")
      .run(update.shareStats ? 1 : 0, update.planId, raceId, userId);
  } else if (update.shareStats !== undefined) {
    getSqlite().prepare("UPDATE race_members SET share_stats = ? WHERE race_id = ? AND user_id = ?")
      .run(update.shareStats ? 1 : 0, raceId, userId);
  } else if (update.planId !== undefined) {
    getSqlite().prepare("UPDATE race_members SET plan_id = ? WHERE race_id = ? AND user_id = ?")
      .run(update.planId, raceId, userId);
  }
}

export async function rotateRaceInvite(raceId: string): Promise<string> {
  await ready();
  const invite = newInviteCode();
  if (usingPg()) await getPg()`UPDATE races SET invite_code = ${invite} WHERE id = ${raceId}`;
  else getSqlite().prepare("UPDATE races SET invite_code = ? WHERE id = ?").run(invite, raceId);
  return invite;
}

export async function removeRaceMember(raceId: string, userId: string): Promise<void> {
  await ready();
  if (usingPg()) await getPg()`DELETE FROM race_members WHERE race_id = ${raceId} AND user_id = ${userId}`;
  else getSqlite().prepare("DELETE FROM race_members WHERE race_id = ? AND user_id = ?").run(raceId, userId);
}

/** Owners transfer to the oldest remaining member; empty races are deleted. */
export async function leaveRace(raceId: string, userId: string): Promise<void> {
  await ready();
  if (usingPg()) {
    const sql = getPg();
    const race = await findRaceById(raceId);
    await sql`DELETE FROM race_members WHERE race_id = ${raceId} AND user_id = ${userId}`;
    if (race?.ownerUserId === userId) {
      const next = (await sql`SELECT user_id FROM race_members WHERE race_id = ${raceId}
        ORDER BY joined_at ASC LIMIT 1`) as { user_id: string }[];
      if (next[0]) await sql`UPDATE races SET owner_user_id = ${next[0].user_id} WHERE id = ${raceId}`;
      else await sql`DELETE FROM races WHERE id = ${raceId}`;
    }
    return;
  }
  const db = getSqlite();
  const tx = db.transaction(() => {
    const race = db.prepare("SELECT owner_user_id FROM races WHERE id = ?").get(raceId) as { owner_user_id: string } | undefined;
    db.prepare("DELETE FROM race_members WHERE race_id = ? AND user_id = ?").run(raceId, userId);
    if (race?.owner_user_id === userId) {
      const next = db.prepare("SELECT user_id FROM race_members WHERE race_id = ? ORDER BY joined_at ASC LIMIT 1").get(raceId) as { user_id: string } | undefined;
      if (next) db.prepare("UPDATE races SET owner_user_id = ? WHERE id = ?").run(next.user_id, raceId);
      else db.prepare("DELETE FROM races WHERE id = ?").run(raceId);
    }
  });
  tx();
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
  // Callers validate first; this is the storage backstop.
  if (Buffer.byteLength(data, "utf8") > MAX_STATE_BYTES) {
    throw new Error("state_too_large");
  }
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

/* ------------------------------ sms sends -------------------------------- */

/**
 * Record that an alert is being sent. Returns false if this (user, key) pair
 * was already recorded, so overlapping cron ticks never text twice.
 */
export async function claimSmsSend(
  userId: string,
  sendKey: string
): Promise<boolean> {
  await ready();
  const now = new Date().toISOString();
  if (usingPg()) {
    const sql = getPg();
    const rows = (await sql`INSERT INTO sms_sends (user_id, send_key, sent_at)
      VALUES (${userId}, ${sendKey}, ${now})
      ON CONFLICT (user_id, send_key) DO NOTHING
      RETURNING user_id`) as { user_id: string }[];
    return rows.length > 0;
  }
  const result = getSqlite()
    .prepare(
      `INSERT INTO sms_sends (user_id, send_key, sent_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, send_key) DO NOTHING`
    )
    .run(userId, sendKey, now);
  return result.changes > 0;
}
