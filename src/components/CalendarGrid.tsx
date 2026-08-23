"use client";

import { useMemo, useState } from "react";
import DurationInput from "@/components/DurationInput";
import PoodleSleeping from "@/components/PoodleSleeping";
import {
  BikeIcon,
  BoltIcon,
  CheckBadgeIcon,
  CheckIcon,
  IconProps,
  MedalIcon,
  MoodIcon,
  PencilIcon,
  RunIcon,
  SwimIcon,
} from "@/components/Icons";
import {
  CalendarCell,
  CalendarRow,
  WEEKDAY_NAMES,
  buildCalendar,
  buildUndatedRows,
  currentRowIndex,
  formatRowLabel,
} from "@/lib/calendar";
import { addDays, isSameDay, startOfToday } from "@/lib/dates";
import { celebrate, celebrationKind } from "@/lib/celebrate";
import { Program, Workout } from "@/lib/programs";
import {
  formatDurationShort,
  formatPacePerMile,
  parseDuration,
  paceSecondsPerMile,
} from "@/lib/pace";
import { Feel, Plan, RunLog, logSeconds } from "@/lib/store";

type ViewMode = "week" | "program";

const FEELS: { value: Feel; label: string }[] = [
  { value: "good", label: "Felt good" },
  { value: "medium", label: "Felt okay" },
  { value: "bad", label: "Felt rough" },
];

/** Rest days render the sleeping poodle instead, so "rest" is never used here. */
const TYPE_ICON: Record<Exclude<Workout["type"], "rest">, (p: IconProps) => JSX.Element> = {
  run: RunIcon,
  "run-or-cross": BikeIcon,
  cross: SwimIcon,
  race: MedalIcon,
};

function WorkoutIcon({ type, size = 22 }: { type: Workout["type"]; size?: number }) {
  if (type === "rest") return <PoodleSleeping size={size + 8} />;
  const Icon = TYPE_ICON[type];
  return <Icon size={size} />;
}

/** Past days read as either done or missed; upcoming days stay neutral. */
type CellStatus = "rest" | "done" | "missed" | "today" | "upcoming";

function cellStatus(
  workout: Workout,
  log: RunLog | undefined,
  isPast: boolean,
  isToday: boolean
): CellStatus {
  if (workout.type === "rest") return "rest";
  if (log?.completed) return "done";
  if (isPast) return "missed";
  return isToday ? "today" : "upcoming";
}

const STATUS_STYLES: Record<CellStatus, string> = {
  rest: "bg-poodle-cream/70 ring-poodle-fur",
  done: "bg-white ring-2 ring-headband",
  missed: "bg-poodle-cream/40 ring-poodle-fur opacity-70",
  today: "bg-white ring-poodle-fur",
  upcoming: "bg-white ring-poodle-fur",
};

function DayCell({
  cell,
  log,
  isToday,
  isPast,
  onToggle,
  onLog,
  onFeel,
}: {
  cell: CalendarCell;
  log: RunLog | undefined;
  isToday: boolean;
  isPast: boolean;
  onToggle: () => void;
  onLog: (miles?: number, seconds?: number) => void;
  onFeel: (feel: Feel) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [miles, setMiles] = useState("");
  const [time, setTime] = useState("");

  const { workout } = cell;
  const status = cellStatus(workout, log, isPast, isToday);
  const isRest = status === "rest";
  const done = status === "done";

  const seconds = logSeconds(log);
  const pace = paceSecondsPerMile(seconds, log?.miles);

  return (
    <div
      className={`relative flex gap-3 rounded-2xl p-2.5 text-xs ring-1 transition md:min-h-[112px] md:flex-col md:gap-0 md:p-2 ${
        STATUS_STYLES[status]
      } ${isToday ? "outline outline-2 outline-offset-2 outline-headband" : ""}`}
    >
      {isToday && (
        <span className="absolute -top-2 right-2 rounded-full bg-headband px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          Today
        </span>
      )}

      {/* Stacked on a phone the row is wide and short, so the artwork leads at a
          size where it is actually readable. The grid keeps the compact icon. */}
      <div className="flex shrink-0 items-center md:hidden">
        <WorkoutIcon type={workout.type} size={44} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* weekday + real date, so the cell reads the same stacked or in a grid */}
        <div className="flex items-baseline justify-between gap-1">
          <span
            className={`text-[10px] font-bold uppercase tracking-wide ${
              isToday ? "text-headband-dark" : "text-foreground/45"
            }`}
          >
            <span className="md:hidden">
              {cell.date.toLocaleDateString(undefined, { weekday: "short" })}{" "}
            </span>
            {cell.date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="mr-14 text-[9px] font-medium text-foreground/35 md:mr-0">
            Day {cell.dayNumber + 1}
          </span>
        </div>

        <div className="mt-0.5 flex items-start justify-between gap-1 md:mt-1">
          <span
            className={`font-semibold leading-tight md:text-xs ${
              isRest ? "text-foreground/50" : ""
            } ${status === "missed" ? "text-foreground/55 line-through decoration-foreground/30" : ""}`}
          >
            {workout.label}
          </span>
          <span className="-mr-0.5 -mt-0.5 hidden shrink-0 md:block">
            <WorkoutIcon type={workout.type} />
          </span>
        </div>

      {status === "missed" && (
        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-foreground/5 px-1.5 py-0.5 text-[9px] font-semibold text-foreground/50">
          <span className="h-1.5 w-1.5 rounded-full ring-1 ring-foreground/30" />
          Missed
        </span>
      )}

      {done && (
        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-headband px-1.5 py-0.5 text-[9px] font-bold text-white">
          <CheckIcon size={9} />
          Done
        </span>
      )}

      {log?.stravaName && (
        <span
          className="mt-1 flex items-center gap-1 truncate text-[10px] text-[#fc4c02]"
          title={log.stravaName}
        >
          <BoltIcon size={11} />
          <span className="truncate">{log.stravaName}</span>
        </span>
      )}

      {done && (log?.miles || seconds) && (
        <span className="mt-0.5 text-[10px] tabular-nums text-foreground/60">
          {log?.miles ? `${log.miles} mi` : ""}
          {log?.miles && seconds ? " · " : ""}
          {seconds ? formatDurationShort(seconds) : ""}
        </span>
      )}
      {done && pace && (
        <span className="text-[10px] font-semibold tabular-nums text-headband-dark">
          {formatPacePerMile(pace)}
        </span>
      )}

      {done && (
        <div className="mt-1 flex items-center gap-0.5" aria-label="How did it feel?">
          {FEELS.map((f) => (
            <button
              key={f.value}
              title={f.label}
              aria-label={f.label}
              aria-pressed={log?.feel === f.value}
              onClick={() => onFeel(f.value)}
              className={`rounded-full p-0.5 transition ${
                log?.feel === f.value
                  ? "bg-headband-light ring-1 ring-headband"
                  : "opacity-40 hover:opacity-100"
              }`}
            >
              <MoodIcon mood={f.value} size={18} />
            </button>
          ))}
        </div>
      )}

      {!isRest && (
        <div className="mt-auto flex items-center gap-1 pt-1">
          <button
            onClick={onToggle}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
              done
                ? "bg-headband text-white"
                : "bg-poodle-cream text-foreground/60 hover:bg-headband-light"
            }`}
          >
            {done ? (
              <span className="flex items-center gap-1">
                Done <CheckIcon size={9} />
              </span>
            ) : (
              "Mark done"
            )}
          </button>
          <button
            onClick={() => setEditing((e) => !e)}
            className="rounded-full p-1 text-foreground/50 transition hover:bg-poodle-cream"
            aria-label="Log distance and time"
          >
            <PencilIcon size={13} />
          </button>
        </div>
      )}

      </div>

      {editing && (
        <form
          className="absolute left-0 top-full z-20 mt-1 flex w-48 flex-col gap-1 rounded-xl bg-white p-2 ring-1 ring-poodle-fur pouf-shadow"
          onSubmit={(e) => {
            e.preventDefault();
            onLog(
              miles ? parseFloat(miles) : undefined,
              time ? parseDuration(time) : undefined
            );
            setEditing(false);
            setMiles("");
            setTime("");
          }}
        >
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Miles"
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            className="rounded-lg border border-poodle-fur px-2 py-1 text-[11px] tabular-nums focus:outline-none focus:ring-2 focus:ring-headband"
          />
          <DurationInput value={time} onChange={setTime} />
          <span className="text-[9px] leading-tight text-foreground/45">
            mm:ss or h:mm:ss, used to compute pace
          </span>
          <button
            type="submit"
            className="rounded-lg bg-headband px-2 py-1 text-[11px] font-semibold text-white"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}

function rowSummary(row: CalendarRow, plan: Plan) {
  let done = 0;
  let total = 0;
  let miles = 0;
  for (const cell of row.cells) {
    if (!cell || cell.workout.type === "rest") continue;
    total += 1;
    const log = plan.logs[cell.key];
    if (log?.completed) {
      done += 1;
      miles +=
        log.miles ??
        (cell.workout.type === "run" ? cell.workout.miles ?? 0 : 0);
    }
  }
  return { done, total, miles: Math.round(miles * 10) / 10 };
}

function WeekdayHeader() {
  return (
    <div className="hidden grid-cols-7 gap-2 px-1 md:grid">
      {WEEKDAY_NAMES.map((d) => (
        <div
          key={d}
          className="text-center text-xs font-bold uppercase tracking-wide text-foreground/50"
        >
          {d}
        </div>
      ))}
    </div>
  );
}

export default function CalendarGrid({
  plan,
  program,
  updatePlan,
}: {
  plan: Plan;
  program: Program;
  updatePlan: (updater: (prev: Plan) => Plan) => void;
}) {
  const [mode, setMode] = useState<ViewMode>("week");
  /**
   * Per-row open/closed overrides in full-program view. Absent means "use the
   * default", which folds weeks that have already finished so a twelve week
   * plan opens as a readable list rather than a wall of cells.
   */
  const [openRows, setOpenRows] = useState<Record<number, boolean>>({});
  const today = startOfToday();

  const rows = useMemo(
    () => buildCalendar(program, plan),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [program, plan.startDate, plan.beginWeek]
  );

  const [weekIndex, setWeekIndex] = useState(() => currentRowIndex(rows));
  // The rows only exist once a race date is set, so re-anchor on the current
  // week whenever the schedule shifts rather than stranding the view on week 1.
  const anchor = `${plan.startDate ?? ""}:${plan.beginWeek ?? 1}`;
  const [anchoredOn, setAnchoredOn] = useState(anchor);
  if (anchoredOn !== anchor) {
    setAnchoredOn(anchor);
    setWeekIndex(currentRowIndex(rows));
  }
  const safeIndex = Math.min(Math.max(weekIndex, 0), Math.max(rows.length - 1, 0));

  const rowHasPassed = (idx: number) =>
    idx < rows.length && addDays(rows[idx].start, 6) < today;

  const isRowOpen = (idx: number, isCurrent: boolean) =>
    openRows[idx] ?? (isCurrent || !rowHasPassed(idx));

  const toggleRow = (idx: number, isCurrent: boolean) =>
    setOpenRows((prev) => ({ ...prev, [idx]: !isRowOpen(idx, isCurrent) }));

  const setAllRows = (open: boolean) =>
    setOpenRows(Object.fromEntries(rows.map((_, i) => [i, open])));

  const openCount = rows.filter((_, i) =>
    isRowOpen(i, i === currentRowIndex(rows))
  ).length;

  const makeHandlers = (cell: CalendarCell) => ({
    onToggle: () => {
      if (!plan.logs[cell.key]?.completed) {
        celebrate(celebrationKind(cell.workout));
      }
      updatePlan((prev) => ({
        ...prev,
        logs: {
          ...prev.logs,
          [cell.key]: {
            ...prev.logs[cell.key],
            completed: !prev.logs[cell.key]?.completed,
          },
        },
      }));
    },
    onLog: (miles?: number, seconds?: number) =>
      updatePlan((prev) => ({
        ...prev,
        logs: {
          ...prev.logs,
          [cell.key]: {
            ...prev.logs[cell.key],
            completed: true,
            miles,
            seconds,
            // drop the legacy field so `logSeconds` can't read a stale value
            minutes: undefined,
          },
        },
      })),
    onFeel: (feel: Feel) =>
      updatePlan((prev) => ({
        ...prev,
        logs: {
          ...prev.logs,
          [cell.key]: {
            ...prev.logs[cell.key],
            completed: true,
            feel: prev.logs[cell.key]?.feel === feel ? undefined : feel,
          },
        },
      })),
  });

  const renderCell = (cell: CalendarCell | null, i: number) => {
    if (!cell) {
      // Outside the plan: an empty desktop slot, nothing at all when stacked.
      return <div key={`empty-${i}`} className="hidden md:block" aria-hidden />;
    }
    const handlers = makeHandlers(cell);
    return (
      <DayCell
        key={cell.key}
        cell={cell}
        log={plan.logs[cell.key]}
        isToday={isSameDay(cell.date, today)}
        isPast={cell.date < today}
        {...handlers}
      />
    );
  };

  // No start date yet, so show the program shape, still Sunday-first.
  if (!plan.startDate) {
    const undated = buildUndatedRows(program);
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-xl bg-headband-light px-4 py-2 text-xs text-headband-dark">
          Set a race date on the Goals page to see real dates and day numbers on
          the calendar.
        </p>
        <WeekdayHeader />
        <div className="space-y-3">
          {undated.map((week) => (
            <div key={week.week}>
              <div className="mb-1 text-xs font-extrabold text-headband-dark">
                Week {week.week}
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {week.cells.map((c, i) =>
                  c ? (
                    <div
                      key={c.key}
                      className={`min-h-[72px] rounded-2xl p-2 text-xs ring-1 ring-poodle-fur ${
                        c.workout.type === "rest"
                          ? "bg-poodle-cream/70"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`font-semibold leading-tight ${
                            c.workout.type === "rest" ? "text-foreground/50" : ""
                          }`}
                        >
                          {c.workout.label}
                        </span>
                        <span className="shrink-0">
                          <WorkoutIcon type={c.workout.type} size={20} />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div key={`e-${i}`} className="hidden md:block" aria-hidden />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const row = rows[safeIndex];

  return (
    <div className="mt-6">
      {/* Sticky so the way back out of a long plan is always on screen. */}
      <div className="sticky top-14 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background/85 px-1 py-2 backdrop-blur">
        <div className="inline-flex rounded-full bg-poodle-cream p-1 ring-1 ring-poodle-fur">
          {(["week", "program"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                if (m === "week") setWeekIndex(currentRowIndex(rows));
              }}
              aria-pressed={mode === m}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                mode === m
                  ? "bg-headband text-white"
                  : "text-foreground/60 hover:text-headband-dark"
              }`}
            >
              {m === "week" ? "This week" : "Full program"}
            </button>
          ))}
        </div>

        {mode === "program" && rows.length > 0 && (
          <button
            onClick={() => setAllRows(openCount <= rows.length / 2)}
            className="rounded-full px-3 py-1.5 text-[11px] font-bold text-headband-dark ring-1 ring-poodle-fur transition hover:bg-poodle-cream"
          >
            {openCount > rows.length / 2 ? "Collapse all weeks" : "Expand all weeks"}
          </button>
        )}

        {mode === "week" && row && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
              className="rounded-full px-2 py-1 text-sm text-foreground/60 ring-1 ring-poodle-fur transition hover:bg-poodle-cream disabled:opacity-30"
              aria-label="Previous week"
            >
              ◂
            </button>
            <div className="min-w-[9rem] text-center">
              <div className="text-sm font-extrabold text-headband-dark">
                {formatRowLabel(row)}
              </div>
              <div className="text-[10px] font-medium text-foreground/50">
                {row.weeks.length > 0
                  ? `Program wk ${row.weeks.join(" & ")}`
                  : "Off-plan week"}
              </div>
            </div>
            <button
              onClick={() =>
                setWeekIndex((i) => Math.min(rows.length - 1, i + 1))
              }
              disabled={safeIndex >= rows.length - 1}
              className="rounded-full px-2 py-1 text-sm text-foreground/60 ring-1 ring-poodle-fur transition hover:bg-poodle-cream disabled:opacity-30"
              aria-label="Next week"
            >
              ▸
            </button>
            {safeIndex !== currentRowIndex(rows) && (
              <button
                onClick={() => setWeekIndex(currentRowIndex(rows))}
                className="rounded-full px-3 py-1 text-[11px] font-semibold text-headband-dark ring-1 ring-poodle-fur hover:bg-poodle-cream"
              >
                Today
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <WeekdayHeader />

        {mode === "week" && row && (
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-7">
            {row.cells.map(renderCell)}
          </div>
        )}

        {mode === "program" && (
          <div className="mt-2 space-y-2">
            {rows.map((r, idx) => {
              const s = rowSummary(r, plan);
              const isCurrent = idx === currentRowIndex(rows);
              const rowInPast = addDays(r.start, 6) < today;
              const open = isRowOpen(idx, isCurrent);
              return (
                <div key={r.start.toISOString()}>
                  {/* The whole header is the control, so a long plan can be
                      folded down to twelve lines without leaving the view. */}
                  <button
                    onClick={() => toggleRow(idx, isCurrent)}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition hover:bg-poodle-cream ${
                      open ? "" : "bg-poodle-cream/50"
                    }`}
                  >
                    <span
                      className={`text-[10px] text-foreground/40 transition-transform ${
                        open ? "rotate-90" : ""
                      }`}
                      aria-hidden
                    >
                      ▸
                    </span>
                    <span
                      className={`font-extrabold ${
                        isCurrent ? "text-headband" : "text-headband-dark"
                      }`}
                    >
                      {formatRowLabel(r)}
                    </span>
                    {r.weeks.length > 0 && (
                      <span className="text-foreground/45">
                        wk {r.weeks.join(" & ")}
                      </span>
                    )}
                    {s.total > 0 && (
                      <span
                        className={
                          rowInPast && s.done < s.total
                            ? "text-amber-600"
                            : "text-foreground/50"
                        }
                      >
                        {s.done}/{s.total} done
                        {s.miles > 0 ? ` · ${s.miles} mi` : ""}
                      </span>
                    )}
                    {s.total > 0 && s.done === s.total && (
                      <CheckBadgeIcon size={13} title="Every workout done" />
                    )}
                    {isCurrent && (
                      <span className="rounded-full bg-headband px-2 py-0.5 text-[9px] font-bold text-white">
                        This week
                      </span>
                    )}
                  </button>
                  {open && (
                    <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-7">
                      {r.cells.map(renderCell)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
