import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Signed session cookies. The payload is readable but tamper-proof: any edit
 * invalidates the HMAC, so a client can't promote itself to another user id.
 */

const SESSION_COOKIE = "pp_session";
const OAUTH_STATE_COOKIE = "pp_oauth_state";
const SESSION_DAYS = 180;

export interface SessionPayload {
  /** Our user id, e.g. "strava:12345". */
  uid: string;
  /** Issued-at and expiry, unix seconds. */
  iat: number;
  exp: number;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (needs 32+ chars). Generate one with: openssl rand -base64 32"
    );
  }
  return value;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function sign(payloadB64: string): string {
  return b64url(createHmac("sha256", secret()).update(payloadB64).digest());
}

export function serializeSession(payload: SessionPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export function parseSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  // Length check first — timingSafeEqual throws on a mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString()
    ) as SessionPayload;
    if (!payload.uid || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const isProd = () => process.env.NODE_ENV === "production";

export function setSession(uid: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid,
    iat: now,
    exp: now + SESSION_DAYS * 86400,
  };
  cookies().set(SESSION_COOKIE, serializeSession(payload), {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}

/** The signed-in user's id, or null. */
export function currentUserId(): string | null {
  return parseSession(cookies().get(SESSION_COOKIE)?.value)?.uid ?? null;
}

/**
 * A random nonce tying an OAuth redirect to this browser. Without it, an
 * attacker could feed us their own `code` and link their Strava to your session.
 */
export function issueOAuthState(): string {
  const state = randomBytes(32).toString("base64url");
  cookies().set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete the round trip
  });
  return state;
}

export function consumeOAuthState(received: string | null): boolean {
  const stored = cookies().get(OAUTH_STATE_COOKIE)?.value;
  cookies().delete(OAUTH_STATE_COOKIE);
  if (!stored || !received) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export { SESSION_COOKIE };
