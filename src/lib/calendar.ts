import {
  addDays,
  fromISO,
  startOfCalendarWeek,
  startOfToday,
  toLocalISO,
} from "@/lib/dates";
import { Program, Workout } from "@/lib/programs";
import { Plan, beginWeekOf, dayIndexAt, logKey } from "@/lib/store";

/** Calendar columns always run Sunday → Saturday. */
export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One scheduled workout, resolved to a real date. */
export interface CalendarCell {
  date: Date;
  iso: string;
  /** Program week (1-based) this workout belongs to. */
  week: number;
  /**
   * The workout's own index in its program week (0 = Monday … 6 = Sunday).
   * This is its identity — the log key is built from it — and it does not
   * change when the runner moves the workout to another day.
   */
  dayIndex: number;
  /**
   * Where in the week the workout actually falls now, 0 = Monday. Equal to
   * `dayIndex` until the runner rearranges the week.
   */
  position: number;
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
    // Walk the week by position, not by the program's own order: a runner who
    // moved Tuesday's tempo run to Wednesday should see it on Wednesday, still
    // carrying whatever was logged against it.
    week.days.forEach((_, position) => {
      const dayIndex = dayIndexAt(plan, week.week, position);
      const workout = week.days[dayIndex];
      if (!workout) return;
      const absoluteDay = (week.week - 1) * 7 + position;
      const date = addDays(start, absoluteDay);
      cells.push({
        // "Day 1" is the runner's first training day, not the program's.
        dayNumber: absoluteDay - offset,
        date,
        iso: toLocalISO(date),
        week: week.week,
        dayIndex,
        position,
        workout,
        key: logKey(week.week, dayIndex),
      });
    });
  }
  return cells;
}

/**
 * Whether a day's workout can be picked up and moved elsewhere in its program
 * week — and, because a move is a swap, equally whether another day's workout
 * can be dropped onto it.
 *
 * Race day is the fixed point the whole plan is anchored to, so it never moves
 * and nothing is ever moved onto it. A workout already done is pinned for the
 * same reason in miniature: the log is written against the workout and travels
 * with it, so moving one would put a session the runner completed on a day
 * they did not train. Rearranging is for the week ahead; the week behind is a
 * record. Unticking a workout makes it movable again.
 */
export function isMovableCell(plan: Plan, cell: CalendarCell): boolean {
  return (
    Boolean(plan.startDate) &&
    cell.workout.type !== "race" &&
    !plan.logs[cell.key]?.completed
  );
}

/**
 * Lay the plan out on a real calendar: rows are Sunday → Saturday, and each
 * workout sits on its actual date. A program week (Mon → Sun) therefore
 * straddles two rows, which is what makes the grid line up with a wall calendar.
 *
 * `extraDates` are ISO dates that must be visible even though no workout is
 * scheduled on them — synced runs outside the plan window, or with no plan at
 * all. The grid stretches to cover them, but weeks with neither a workout nor
 * a run are dropped so a far-off race doesn't produce a wall of empty rows.
 *
 * Today's week is the one exception to that pruning: it is always present, so
 * the grid can always say where "now" is. Without it a plan starting tomorrow
 * renders a calendar with no way at all to find the current day.
 */
export function buildCalendar(
  program: Program,
  plan: Plan,
  extraDates: string[] = []
): CalendarRow[] {
  const cells = planCells(program, plan);
  const extras = new Set(extraDates);
  const dates = [
    ...cells.map((c) => c.date),
    ...extraDates.map(fromISO),
  ].sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return [];

  const byIso = new Map(cells.map((c) => [c.iso, c]));
  // Stretch the span over today as well as the scheduled and logged days, so
  // the current week exists whether it falls before, inside, or after the plan.
  const today = startOfToday();
  const todayRowStart = startOfCalendarWeek(today);
  const first = dates[0] < today ? dates[0] : today;
  const lastDate = dates[dates.length - 1];
  const last = lastDate > today ? lastDate : today;
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
    let hasExtra = false;
    for (let i = 0; i < 7; i++) {
      const iso = toLocalISO(addDays(rowStart, i));
      rowCells.push(byIso.get(iso) ?? null);
      if (extras.has(iso)) hasExtra = true;
    }
    const weeks = Array.from(
      new Set(rowCells.filter(Boolean).map((c) => c!.week))
    ).sort((a, b) => a - b);
    const isTodayRow = rowStart.getTime() === todayRowStart.getTime();
    if (weeks.length === 0 && !hasExtra && !isTodayRow) continue;
    rows.push({ start: rowStart, cells: rowCells, weeks });
  }
  return rows;
}

/**
 * Program weeks as rows when there's no start date yet. Columns still read
 * Sunday → Saturday by placing each workout on its intrinsic weekday, so the
 * layout doesn't jump around once a date is set.
 */
export function buildUndatedRows(
  program: Program,
  plan?: Plan
): {
  week: number;
  cells: ({ workout: Workout; dayIndex: number; key: string } | null)[];
}[] {
  // Position 0 = Monday, so weekday column = (position + 1) % 7.
  return program.schedule.map((week) => {
    const cells: ({ workout: Workout; dayIndex: number; key: string } | null)[] =
      Array(7).fill(null);
    week.days.forEach((_, position) => {
      const dayIndex = plan ? dayIndexAt(plan, week.week, position) : position;
      const workout = week.days[dayIndex];
      if (!workout) return;
      cells[(position + 1) % 7] = {
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

/** "Day 3 · Nov 2": the plan-relative day paired with the real date. */
export function formatDayStamp(cell: CalendarCell): string {
  return `Day ${cell.dayNumber + 1} · ${formatShortDate(cell.date)}`;
}
