/**
 * Verifies GitHub Actions OIDC tokens so the scheduled-alerts workflow can
 * authenticate without a shared secret: the workflow mints a short-lived
 * signed JWT and this checks its signature against GitHub's published keys,
 * plus that it was minted by this repo's workflow for this audience.
 */
import { createPublicKey, verify as verifySignature } from "node:crypto";

const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
export const CRON_AUDIENCE = "poodle-pacer-cron";
const ALLOWED_REPOSITORY = "anastosj/poodle-pacer";
const JWKS_TTL_MS = 60 * 60 * 1000;

interface Jwk {
  kid: string;
  kty: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

async function getJwks(): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

function decodeSegment(segment: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString());
  } catch {
    return null;
  }
}

/** True when `token` is a valid GitHub Actions OIDC token from this repo. */
export async function verifyGitHubCronToken(token: string): Promise<boolean> {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return false;

  const header = decodeSegment(headerB64);
  const payload = decodeSegment(payloadB64);
  if (!header || !payload) return false;
  if (header.alg !== "RS256" || typeof header.kid !== "string") return false;

  let jwk: Jwk | undefined;
  try {
    jwk = (await getJwks()).find(
      (k) => k.kid === header.kid && k.kty === "RSA"
    );
  } catch {
    return false;
  }
  if (!jwk) return false;

  const key = createPublicKey({ key: jwk, format: "jwk" });
  const signed = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(signatureB64, "base64url");
  if (!verifySignature("RSA-SHA256", signed, key, signature)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < nowSeconds) return false;
  if (typeof payload.nbf === "number" && payload.nbf > nowSeconds) return false;

  return (
    payload.iss === ISSUER &&
    payload.aud === CRON_AUDIENCE &&
    payload.repository === ALLOWED_REPOSITORY
  );
}
