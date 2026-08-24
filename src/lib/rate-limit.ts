// Minimal in-memory fixed-window limiter, enough to stop one account from
// hammering a write endpoint. Per instance, which is all a single-process
// Next.js server can offer without pulling in extra infrastructure.

const windows = new Map<string, { count: number; resetAt: number }>();

/** True when the caller is still within its allowance for this window. */
export function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): boolean {
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic sweep so abandoned keys cannot grow the map forever.
    if (windows.size > 5000) {
      Array.from(windows.entries()).forEach(([k, v]) => {
        if (v.resetAt <= now) windows.delete(k);
      });
    }
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
