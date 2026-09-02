/** Local-time date primitives. Kept free of app imports so anything can use them. */

export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = fromISO(value);
  return !Number.isNaN(date.getTime()) && toLocalISO(date) === value;
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function addDaysISO(iso: string, days: number): string {
  return toLocalISO(addDays(fromISO(iso), days));
}

/** Local midnight today: the anchor for past/today/future comparisons. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Day of the week with Monday first: 0 = Monday … 6 = Sunday. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** The Monday on or before `d`. Weeks run Monday → Sunday everywhere. */
export function startOfCalendarWeek(d: Date): Date {
  return addDays(d, -weekdayIndex(d));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The same day of the month `months` away, clamped to the target month's
 * length. Plain `setMonth` rolls a 31st into the next month, which turns
 * "six months back from August 31st" into March.
 */
export function addMonths(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(d.getDate(), lastDay)
  );
}
