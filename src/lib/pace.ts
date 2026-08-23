/** Duration parsing/formatting and pace math. */

/** "42:30" → 2550 · "1:23:45" → 5025 · "42" → 2520 (bare numbers are minutes). */
export function parseDuration(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const parts = trimmed.split(":");
  if (parts.length === 1) {
    const minutes = Number(parts[0]);
    return Number.isFinite(minutes) && minutes >= 0
      ? Math.round(minutes * 60)
      : undefined;
  }
  if (parts.length > 3) return undefined;

  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return undefined;

  // Right-aligned: [ss], [mm, ss], or [hh, mm, ss].
  const seconds = nums.pop() ?? 0;
  const minutes = nums.pop() ?? 0;
  const hours = nums.pop() ?? 0;
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

/** 5025 → "1:23:45" · 2550 → "42:30". Hours are dropped when zero. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** Compact form for dense cells: "1h 23m" / "42m 30s". */
export function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  const seconds = s % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function paceSecondsPerMile(
  seconds: number | undefined,
  miles: number | undefined
): number | undefined {
  if (!seconds || !miles || miles <= 0) return undefined;
  return seconds / miles;
}

/** 522 → "8:42". */
export function formatPace(secondsPerMile: number | undefined): string {
  if (secondsPerMile === undefined || !Number.isFinite(secondsPerMile)) return "–";
  const total = Math.round(secondsPerMile);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatPacePerMile(secondsPerMile: number | undefined): string {
  const pace = formatPace(secondsPerMile);
  return pace === "–" ? "–" : `${pace}/mi`;
}

/**
 * Signed delta between two paces, phrased for runners: a *smaller* seconds/mile
 * is faster, so a negative delta is an improvement.
 */
export function paceDelta(
  current: number | undefined,
  previous: number | undefined
): { seconds: number; faster: boolean } | undefined {
  if (current === undefined || previous === undefined) return undefined;
  const seconds = current - previous;
  return { seconds: Math.abs(seconds), faster: seconds < 0 };
}
