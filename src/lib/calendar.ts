import {
  addDays,
  fromISO,
  startOfCalendarWeek,
  startOfToday,
  toLocalISO,
} from "@/lib/dates";
import { Program, Workout } from "@/lib/programs";
import { Plan, beginWeekOf, logKey } from "@/lib/store";

/** Calendar columns always run Sunday → Saturday. */
export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One scheduled workout, resolved to a real date. */
export interface CalendarCell {
  date: Date;
  iso: string;
  /** Program week (1-based) this workout belongs to. */
  week: number;
  /** Index within the program week (0 = Monday … 6 = Sunday). */
  dayIndex: number;
  /** Absolute day of the plan, 0-based. Display as `Day ${dayNumber + 1}`. */
  dayNumber: number;
  workout: Workout;
  key: string;
}

/** One calendar week: seven columns, Sunday → Saturday. */
export interface CalendarRow {
  /** The Sunday that starts this row. */
  start: Date;
  /** Length 7, Sun → Sat. `null` = outside the training plan. */
  cells: (CalendarCell | null)[];
  /** Program weeks that appear in this row, ascending. */
  weeks: number[];
}

/**
 * Flatten a program's schedule into dated cells, skipping any weeks before the
 * runner joined. Day numbers stay relative to their first training day.
 */
export function planCells(program: Program, plan: Plan): CalendarCell[] {
  if (!plan.startDate) return [];
  const start = fromISO(plan.startDate);
  const beginWeek = beginWeekOf(plan);
  const offset = (beginWeek - 1) * 7;
  const cells: CalendarCell[] = [];
  for (const week of program.schedule) {
    if (week.week < beginWeek) continue;
    week.days.forEach((workout, dayIndex) => {
      const absoluteDay = (week.week - 1) * 7 + dayIndex;
      const date = addDays(start, absoluteDay);
      cells.push({
        // "Day 1" is the runner's first training day, not the program's.
        dayNumber: absoluteDay - offset,
        date,
        iso: toLocalISO(date),
        week: week.week,
        dayIndex,
        workout,
        key: logKey(week.week, dayIndex),
      });
    });
  }
  return cells;
}

/**
 * Lay the plan out on a real calendar: rows are Sunday → Saturday, and each
 * workout sits on its actual date. A program week (Mon → Sun) therefore
 * straddles two rows, which is what makes the grid line up with a wall calendar.
 */
export function buildCalendar(program: Program, plan: Plan): CalendarRow[] {
  const cells = planCells(program, plan);
  if (cells.length === 0) return [];

  const byIso = new Map(cells.map((c) => [c.iso, c]));
  const first = cells[0].date;
  const last = cells[cells.length - 1].date;

  const gridStart = startOfCalendarWeek(first);
  // Pad forward to the Saturday on or after the final day.
  const gridEnd = addDays(startOfCalendarWeek(last), 6);

  const rows: CalendarRow[] = [];
  for (
    let rowStart = gridStart;
    rowStart <= gridEnd;
    rowStart = addDays(rowStart, 7)
  ) {
    const rowCells: (CalendarCell | null)[] = [];
    for (let i = 0; i < 7; i++) {
      rowCells.push(byIso.get(toLocalISO(addDays(rowStart, i))) ?? null);
    }
    const weeks = Array.from(
      new Set(rowCells.filter(Boolean).map((c) => c!.week))
    ).sort((a, b) => a - b);
    rows.push({ start: rowStart, cells: rowCells, weeks });
  }
  return rows;
}

/**
 * Program weeks as rows when there's no start date yet. Columns still read
 * Sunday → Saturday by placing each workout on its intrinsic weekday, so the
 * layout doesn't jump around once a date is set.
 */
export function buildUndatedRows(program: Program): {
  week: number;
  cells: ({ workout: Workout; dayIndex: number; key: string } | null)[];
}[] {
  // Program day 0 = Monday, so weekday column = (dayIndex + 1) % 7.
  return program.schedule.map((week) => {
    const cells: ({ workout: Workout; dayIndex: number; key: string } | null)[] =
      Array(7).fill(null);
    week.days.forEach((workout, dayIndex) => {
      cells[(dayIndex + 1) % 7] = {
        workout,
        dayIndex,
        key: logKey(week.week, dayIndex),
      };
    });
    return { week: week.week, cells };
  });
}

/** Index of the calendar row containing today, or the nearest upcoming row. */
export function currentRowIndex(rows: CalendarRow[]): number {
  if (rows.length === 0) return 0;
  const today = startOfToday();
  const idx = rows.findIndex(
    (r) => today >= r.start && today <= addDays(r.start, 6)
  );
  if (idx >= 0) return idx;
  // Before the plan starts → first row. After it ends → last row.
  return today < rows[0].start ? 0 : rows.length - 1;
}

export function formatRowLabel(row: CalendarRow): string {
  const end = addDays(row.start, 6);
  const sameMonth = row.start.getMonth() === end.getMonth();
  const startStr = row.start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endStr = end.toLocaleDateString(
    undefined,
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" }
  );
  return `${startStr} – ${endStr}`;
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Day 3 · Nov 2" — the plan-relative day paired with the real date. */
export function formatDayStamp(cell: CalendarCell): string {
  return `Day ${cell.dayNumber + 1} · ${formatShortDate(cell.date)}`;
}
