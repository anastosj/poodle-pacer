"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DurationInput from "@/components/DurationInput";
import PoodleSleeping from "@/components/PoodleSleeping";
import WorkoutDetail from "@/components/WorkoutDetail";
import {
  BikeIcon,
  BoltIcon,
  CheckBadgeIcon,
  CheckIcon,
  ChevronIcon,
  IconProps,
  MedalIcon,
  MoodIcon,
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
import {
  Program,
  Workout,
  workoutTracksRunningMiles,
} from "@/lib/programs";
import {
  formatDurationShort,
  formatPacePerMile,
  parseDuration,
  paceSecondsPerMile,
} from "@/lib/pace";
import { Feel, Plan, RunLog, logSeconds } from "@/lib/store";
import SegmentedToggle from "@/components/ui/SegmentedToggle";

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
  swim: SwimIcon,
  bike: BikeIcon,
  brick: BoltIcon,
  multi: BoltIcon,
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
  rest: "border-outline bg-surface-tinted",
  done: "border-outline bg-periwinkle",
  missed: "border-outline bg-lilac opacity-70",
  today: "border-outline bg-highlight",
  upcoming: "border-outline bg-surface",
};

function DayCell({
  cell,
  log,
  isToday,
  isPast,
  onToggle,
  onLog,
  onFeel,
  onOpen,
}: {
  cell: CalendarCell;
  log: RunLog | undefined;
  isToday: boolean;
  isPast: boolean;
  onToggle: () => void;
  onLog: (miles?: number, seconds?: number) => void;
  onFeel: (feel: Feel) => void;
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  /** Actions sit behind a caret so a cell reads as the workout, not controls. */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [miles, setMiles] = useState("");
  const [time, setTime] = useState("");

  const { workout } = cell;
  const status = cellStatus(workout, log, isPast, isToday);
  const isRest = status === "rest";
  const done = status === "done";

  /** One exit for every route out of the editor, so nothing is left half typed. */
  const closeEditor = () => {
    setEditing(false);
    setMiles("");
    setTime("");
  };

  useEffect(() => {
    if (!editing) return;
    const onClick = (e: MouseEvent) => {
      if (!formRef.current?.contains(e.target as Node)) closeEditor();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeEditor();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const seconds = logSeconds(log);
  const pace = paceSecondsPerMile(seconds, log?.miles);

  /**
   * Rendered in two places: on a phone it sits in the meta line, where the row
   * is wide and the right side would otherwise be empty; in the desktop grid a
   * column is narrow, so it stays pinned to the bottom. The menu is absolutely
   * positioned either way, so opening it never reflows the card.
   */
  const actions = isRest ? null : (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={done ? "Edit this workout" : "Mark done or edit"}
        className={`focus-pouf flex items-center justify-center rounded-sm px-2 py-0.5 transition hover:bg-lilac md:w-full ${
          menuOpen
            ? "bg-lilac text-ink"
            : "text-ink-soft hover:text-ink"
        }`}
      >
        <ChevronIcon up={menuOpen} size={14} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-32 overflow-hidden rounded-sm border-2 border-outline bg-surface py-1 text-left shadow-soft"
        >
          <button
            role="menuitem"
            onClick={() => {
              onToggle();
              setMenuOpen(false);
            }}
            className="focus-pouf block w-full px-3 py-1.5 text-meta font-bold text-ink hover:bg-lilac"
          >
            {done ? "Mark not done" : "Mark done"}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setEditing(true);
              setMenuOpen(false);
            }}
            className="focus-pouf block w-full px-3 py-1.5 text-meta font-bold text-ink hover:bg-lilac"
          >
            {done ? "Edit details" : "Log details"}
          </button>
        </div>
      )}
    </div>
  );

  const statusChip =
    status === "missed" ? (
        <span className="inline-flex items-center gap-1 rounded-full border-2 border-outline bg-surface px-1.5 py-0.5 text-meta font-bold text-ink-soft">
        <span className="h-1.5 w-1.5 rounded-full border border-outline" />
        Missed
      </span>
    ) : done ? (
      <span className="inline-flex items-center gap-1 rounded-full border-2 border-outline bg-ink px-1.5 py-0.5 text-meta font-bold text-background">
        <CheckIcon size={9} />
        Done
      </span>
    ) : null;

  return (
    <div
      className={`relative flex gap-3 rounded-sm border-3 p-2.5 text-body transition md:min-h-[112px] md:flex-col md:gap-0 md:p-2 ${
        STATUS_STYLES[status]
      } ${isToday ? "rotate-[-1deg] outline outline-2 outline-offset-2 outline-primary" : ""}`}
    >
      {isToday && (
        <span className="absolute -top-2 right-2 hidden rounded-full border-2 border-outline bg-ink px-2 py-0.5 text-meta font-bold uppercase tracking-wide text-background md:inline-block">
          Today
        </span>
      )}

      {/* Top aligned, not centred: a tall card left the artwork floating in
          the middle with the text stranded beside it. */}
      <div className="flex shrink-0 items-start pt-0.5 md:hidden">
        <WorkoutIcon type={workout.type} size={44} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Meta line. On a phone the day number sits next to the date and the
            controls take the free space on the right. */}
        <div className="flex items-center gap-2">
          <span
              className={`text-meta font-bold uppercase tracking-wide ${
              isToday ? "text-ink" : "text-ink-soft"
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
          <span className="text-meta text-ink-soft md:ml-auto">
            Day {cell.dayNumber + 1}
          </span>
          {isToday && (
            <span className="rounded-full border-2 border-outline bg-ink px-1.5 py-0.5 text-meta font-bold uppercase tracking-wide text-background md:hidden">
              Today
            </span>
          )}
          <span className="ml-auto md:hidden">{actions}</span>
        </div>

        {/* The artwork sits outside the wrapping group and never moves: when it
            shared a wrapping row with the title and the status chip, it landed
            wherever those happened to break, so no two cards lined up. */}
        <div className="mt-0.5 flex items-start gap-1.5 md:mt-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`font-semibold leading-tight md:text-xs ${
                isRest ? "text-foreground/50" : ""
              } ${status === "missed" ? "text-foreground/55 line-through decoration-foreground/30" : ""}`}
            >
              {workout.label}
            </span>
            {/* Inline on a phone, where the row is wide enough to spare. */}
            <span className="md:hidden">{statusChip}</span>
          </div>
          <span className="-mr-0.5 hidden shrink-0 self-start md:block">
            <WorkoutIcon type={workout.type} />
          </span>
        </div>

        {statusChip && <div className="mt-1 hidden md:block">{statusChip}</div>}

        {(log?.stravaName || (done && (log?.miles || seconds))) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {log?.stravaName && (
              <span
                className="flex min-w-0 items-center gap-1 text-meta text-orange-700"
                title={log.stravaName}
              >
                <BoltIcon size={11} />
                <span className="truncate">{log.stravaName}</span>
              </span>
            )}
            {done && (log?.miles || seconds) && (
              <button
                onClick={onOpen}
                title="See splits, route, and heart rate"
                className="-mx-1 flex flex-wrap items-center gap-x-1.5 rounded-sm px-1 py-0.5 text-left transition hover:bg-surface"
              >
                <span className="text-meta tabular-nums text-ink-soft">
                  {log?.miles ? `${log.miles} mi` : ""}
                  {log?.miles && seconds ? " · " : ""}
                  {seconds ? formatDurationShort(seconds) : ""}
                </span>
                {pace && (
                    <span className="text-meta font-bold tabular-nums text-primary underline underline-offset-2">
                    {formatPacePerMile(pace)}
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        {done && (
          <div
            className="mt-1 flex items-center gap-0.5"
            aria-label="How did it feel?"
          >
            {FEELS.map((f) => (
              <button
                key={f.value}
                title={f.label}
                aria-label={f.label}
                aria-pressed={log?.feel === f.value}
                onClick={() => onFeel(f.value)}
              className={`focus-pouf rounded-full p-0.5 transition ${
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

        <div className="mt-auto hidden pt-1 md:block">{actions}</div>
      </div>

      {editing && (
        <form
          ref={formRef}
          className="absolute left-0 top-full z-20 mt-1 flex w-48 flex-col gap-1 rounded-sm border-2 border-outline bg-surface p-2 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            onLog(
              workoutTracksRunningMiles(workout) && miles
                ? parseFloat(miles)
                : undefined,
              time ? parseDuration(time) : undefined
            );
            closeEditor();
          }}
        >
          <div className="flex items-center justify-between gap-2 pb-0.5">
            <span className="text-meta font-bold uppercase tracking-wide text-ink-soft">
              Log this workout
            </span>
            <button
              type="button"
              onClick={closeEditor}
              aria-label="Close without saving"
              className="focus-pouf rounded-full px-1.5 text-sm leading-none text-ink-soft transition hover:bg-lilac hover:text-ink"
            >
              &#215;
            </button>
          </div>
          {workoutTracksRunningMiles(workout) && (
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Running miles"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              className="focus-pouf rounded-sm border-2 border-outline px-2 py-1 text-meta tabular-nums"
            />
          )}
          <DurationInput value={time} onChange={setTime} />
          <span className="text-meta leading-tight text-ink-soft">
            {workoutTracksRunningMiles(workout)
              ? "mm:ss or h:mm:ss, used to compute pace"
              : "mm:ss or h:mm:ss"}
          </span>
          <button
            type="submit"
            className="hard-button focus-pouf rounded-sm bg-primary px-2 py-1 text-meta font-bold text-white"
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
      miles += workoutTracksRunningMiles(cell.workout)
        ? log.miles ??
          (cell.workout.type === "run-or-cross"
            ? 0
            : cell.workout.miles ?? 0)
        : 0;
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
          className="text-center text-meta font-bold uppercase tracking-wide text-ink-soft"
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
  /** The completed day whose detail sheet is showing, if any. */
  const [detailCell, setDetailCell] = useState<CalendarCell | null>(null);
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
        onOpen={() => setDetailCell(cell)}
        {...handlers}
      />
    );
  };

  // No start date yet, so show the program shape, still Sunday-first.
  if (!plan.startDate) {
    const undated = buildUndatedRows(program);
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-sm border-2 border-outline bg-highlight px-4 py-2 text-meta font-bold text-ink">
          Set a race date on the Goals page to see real dates and day numbers on
          the calendar.
        </p>
        <WeekdayHeader />
        <div className="space-y-3">
          {undated.map((week) => (
            <div key={week.week}>
              <div className="mb-1 type-overline text-primary-dark">
                Week {week.week}
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {week.cells.map((c, i) =>
                  c ? (
                    <div
                      key={c.key}
                      className={`min-h-[72px] rounded-sm border-3 border-outline p-2 text-body ${
                        c.workout.type === "rest"
                          ? "bg-lilac"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`font-semibold leading-tight ${
                            c.workout.type === "rest" ? "text-ink-soft" : "font-display uppercase"
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
      <div className="sticky top-14 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 bg-background/90 px-1 py-2 backdrop-blur">
        <SegmentedToggle
          options={["week", "program"] as const}
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (m === "week") setWeekIndex(currentRowIndex(rows));
          }}
          getLabel={(m) => (m === "week" ? "This week" : "Full program")}
        />

        {mode === "program" && rows.length > 0 && (
          <button
            onClick={() => setAllRows(openCount <= rows.length / 2)}
            className="focus-pouf rounded-full border-2 border-outline px-3 py-1.5 text-meta font-bold text-primary-dark transition hover:bg-lilac"
          >
            {openCount > rows.length / 2 ? "Collapse all weeks" : "Expand all weeks"}
          </button>
        )}

        {mode === "week" && row && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
              className="focus-pouf rounded-full border-2 border-outline px-2 py-1 text-sm text-ink-muted transition hover:bg-lilac disabled:opacity-30"
              aria-label="Previous week"
            >
              ◂
            </button>
            <div className="min-w-[9rem] text-center">
              <div className="font-display text-title text-primary-dark">
                {formatRowLabel(row)}
              </div>
              <div className="text-meta text-ink-soft">
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
              className="focus-pouf rounded-full border-2 border-outline px-2 py-1 text-sm text-ink-muted transition hover:bg-lilac disabled:opacity-30"
              aria-label="Next week"
            >
              ▸
            </button>
            {safeIndex !== currentRowIndex(rows) && (
              <button
                onClick={() => setWeekIndex(currentRowIndex(rows))}
                className="focus-pouf rounded-full border-2 border-outline px-3 py-1 text-meta font-bold text-primary-dark hover:bg-lilac"
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

        {detailCell && plan.logs[detailCell.key] && (
          <WorkoutDetail
            log={plan.logs[detailCell.key]}
            label={detailCell.workout.label}
            dateLabel={detailCell.date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            onClose={() => setDetailCell(null)}
          />
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
                    className={`focus-pouf flex w-full items-center gap-2 rounded-sm border-2 border-outline px-2 py-1.5 text-left text-body transition hover:bg-lilac ${
                        open ? "bg-surface" : "bg-lilac"
                    }`}
                  >
                    <span
                      className={`text-meta text-ink-soft transition-transform ${
                        open ? "rotate-90" : ""
                      }`}
                      aria-hidden
                    >
                      ▸
                    </span>
                    <span
                      className={`font-extrabold ${
                        isCurrent ? "text-primary" : "text-primary-dark"
                      }`}
                    >
                      {formatRowLabel(r)}
                    </span>
                    {r.weeks.length > 0 && (
                      <span className="text-ink-soft">
                        wk {r.weeks.join(" & ")}
                      </span>
                    )}
                    {s.total > 0 && (
                      <span
                        className={
                          rowInPast && s.done < s.total
                            ? "text-accent"
                            : "text-ink-soft"
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
                      <span className="rounded-full border-2 border-outline bg-ink px-2 py-0.5 text-meta font-bold text-highlight">
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
