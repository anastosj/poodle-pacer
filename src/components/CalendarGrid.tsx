"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import DurationInput from "@/components/DurationInput";
import WorkoutDetail from "@/components/WorkoutDetail";
import WorkoutIcon from "@/components/WorkoutIcon";
import {
  BikeIcon,
  BoltIcon,
  CheckBadgeIcon,
  CheckIcon,
  ChevronIcon,
  MoodIcon,
  PoodleFaceIcon,
  RunIcon,
  SwimIcon,
} from "@/components/Icons";
import {
  activityKind,
  activityLabel,
  countsAsRunning,
  formatDistance,
  formatSpeed,
  tracksDistance,
} from "@/lib/activities";
import {
  CalendarCell,
  CalendarRow,
  WEEKDAY_NAMES,
  buildCalendar,
  buildUndatedRows,
  currentRowIndex,
  formatRowLabel,
} from "@/lib/calendar";
import {
  addDays,
  fromISO,
  isSameDay,
  startOfMonth,
  startOfToday,
  toLocalISO,
} from "@/lib/dates";
import { celebrate, celebrationKind } from "@/lib/celebrate";
import {
  Program,
  Workout,
  loggableDistanceUnit,
  workoutSportType,
  workoutTracksRunningMiles,
  yardsToMiles,
} from "@/lib/programs";
import {
  formatDurationShort,
  formatPacePerMile,
  parseDuration,
  paceSecondsPerMile,
} from "@/lib/pace";
import {
  FEEL_LABEL,
  Feel,
  Plan,
  RunLog,
  SyncedRun,
  daysUntilStart,
  isPausedOn,
  logSeconds,
  matchedActivityIds,
  runAsLog,
} from "@/lib/store";
import SegmentedToggle from "@/components/ui/SegmentedToggle";

/**
 * Two scopes only. A full-program list sounds useful and reads as a wall: with
 * synced history it scrolled back through months of activity nobody was
 * looking for. Month view covers the same ground a month at a time, forwards
 * into the plan as well as back over what was done.
 */
type ViewMode = "week" | "month";

const MODES = ["week", "month"] as const;

/**
 * Written out rather than built from the value, so Tailwind's scanner sees
 * every class it has to generate.
 */
const FEELS: { value: Feel; on: string; hover: string }[] = [
  { value: "good", on: "bg-mood-good", hover: "hover:bg-mood-good" },
  { value: "medium", on: "bg-mood-okay", hover: "hover:bg-mood-okay" },
  { value: "bad", on: "bg-mood-rough", hover: "hover:bg-mood-rough" },
];

/** The first of another month, relative to this one. */
function shiftMonth(d: Date, by: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + by, 1);
}

/**
 * "6/8 done · 12.3 mi run" for the month shown, or a nudge when it is empty.
 *
 * Counted a day at a time rather than a row at a time: calendar rows straddle
 * month boundaries, so summing the rows this month renders would fold in a
 * handful of days belonging to the month either side.
 */
function monthSummary(
  monthStart: Date,
  rows: CalendarRow[],
  plan: Plan,
  extraByIso: Map<string, SyncedRun[]>
): string {
  const inMonth = (d: Date) =>
    d.getFullYear() === monthStart.getFullYear() &&
    d.getMonth() === monthStart.getMonth();

  let done = 0;
  let total = 0;
  let extras = 0;
  let miles = 0;

  for (const row of rows) {
    row.cells.forEach((cell, i) => {
      const date = addDays(row.start, i);
      if (!inMonth(date)) return;
      if (cell && cell.workout.type !== "rest") {
        total += 1;
        const log = plan.logs[cell.key];
        if (log?.completed) {
          done += 1;
          // Only running miles are quoted, matching every other total in the app.
          miles += workoutTracksRunningMiles(cell.workout)
            ? log.miles ??
              (cell.workout.type === "run-or-cross" ? 0 : cell.workout.miles ?? 0)
            : 0;
        }
      }
      for (const run of extraByIso.get(toLocalISO(date)) ?? []) {
        extras += 1;
        if (countsAsRunning(run.sportType)) miles += run.miles;
      }
    });
  }

  const parts: string[] = [];
  if (total > 0) parts.push(`${done}/${total} done`);
  // Off-plan activity is only worth naming when there is no plan tally to
  // read it against; otherwise it is already inside the mileage.
  else if (extras > 0)
    parts.push(`${extras} ${extras === 1 ? "activity" : "activities"}`);
  if (miles > 0) parts.push(`${Math.round(miles * 10) / 10} mi run`);
  return parts.length > 0 ? parts.join(" · ") : "Nothing logged";
}

/**
 * Past days read as either done or missed; upcoming days stay neutral. A day
 * inside a stood-down stretch is neither — it is a day the runner already
 * accounted for, and saying "missed" over the top of that is the wall of red
 * pausing exists to remove. Work that was logged still shows as done, since
 * standing the plan down never erases a run that happened.
 */
type CellStatus = "rest" | "done" | "paused" | "missed" | "today" | "upcoming";

function cellStatus(
  workout: Workout,
  log: RunLog | undefined,
  isPast: boolean,
  isToday: boolean,
  isPaused: boolean
): CellStatus {
  if (log?.completed) return "done";
  // Rest days were never a reproach, so pausing has nothing to soften on them;
  // marking them too would only spread dashes across days that read fine.
  if (workout.type === "rest") return "rest";
  if (isPaused) return "paused";
  if (isPast) return "missed";
  return isToday ? "today" : "upcoming";
}

const STATUS_STYLES: Record<CellStatus, string> = {
  rest: "border-outline bg-surface-tinted",
  done: "border-outline bg-periwinkle",
  paused: "border-dashed border-ink-soft bg-surface-tinted opacity-80",
  missed: "border-outline bg-lilac opacity-70",
  today: "border-outline bg-highlight",
  upcoming: "border-outline bg-surface",
};

function DayCell({
  cell,
  log,
  isToday,
  isPast,
  isPaused,
  onToggle,
  onLog,
  onFeel,
  onOpen,
}: {
  cell: CalendarCell;
  log: RunLog | undefined;
  isToday: boolean;
  isPast: boolean;
  /** Inside a stretch the runner stood the plan down for. */
  isPaused: boolean;
  onToggle: () => void;
  onLog: (miles?: number, seconds?: number, sportType?: string) => void;
  onFeel: (feel: Feel) => void;
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  /** Actions sit behind a caret so a cell reads as the workout, not controls. */
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [miles, setMiles] = useState("");
  const [time, setTime] = useState("");

  const { workout } = cell;
  const distanceUnit = loggableDistanceUnit(workout);
  const status = cellStatus(workout, log, isPast, isToday, isPaused);
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
      const target = e.target as Node;
      if (
        !mobileMenuRef.current?.contains(target) &&
        !desktopMenuRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
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
  const renderActions = (menuRef: RefObject<HTMLDivElement>) =>
    isRest ? null : (
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
    status === "paused" ? (
      <span className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-ink-soft bg-surface px-1.5 py-0.5 text-meta font-bold text-ink-soft">
        Paused
      </span>
    ) : status === "missed" ? (
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
      className={`relative flex gap-3 rounded-sm border-3 p-2.5 text-body shadow-card transition md:min-h-[112px] md:flex-col md:gap-0 md:p-2 ${
        STATUS_STYLES[status]
      } ${isToday ? "rotate-[-1.5deg] outline outline-2 outline-offset-2 outline-primary" : ""}`}
    >
      {isToday && (
        // Sits high enough to clear the day number, which is right aligned to
        // the same corner.
        <span className="absolute -top-5 right-2 z-10 hidden rounded-full border-2 border-outline bg-ink px-2 py-0.5 text-meta font-bold uppercase tracking-wide text-background md:inline-block">
          Today
        </span>
      )}

      {/* Top aligned, not centred: a tall card left the artwork floating in
          the middle with the text stranded beside it. */}
      <div className="flex shrink-0 items-start pt-0.5 md:hidden">
        <WorkoutIcon type={workout.type} size={50} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Meta line. On a phone the day number sits next to the date and the
            controls take the free space on the right. */}
        <div className="flex items-center gap-2">
          <span
              className={`shrink-0 text-meta font-bold uppercase tracking-wide ${
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
          {/* The Today badge floats above the card's top edge, so nothing in
              here has to reserve room for it. */}
          <span className="shrink-0 whitespace-nowrap text-meta text-ink-soft md:ml-auto">
            Day {cell.dayNumber + 1}
          </span>
          {isToday && (
            <span className="z-10 shrink-0 rounded-full border-2 border-outline bg-ink px-1.5 py-0.5 text-meta font-bold uppercase tracking-wide text-background md:hidden">
              Today
            </span>
          )}
          <span className="ml-auto md:hidden">
            {renderActions(mobileMenuRef)}
          </span>
        </div>

        {/* The artwork sits outside the wrapping group and never moves: when it
            shared a wrapping row with the title and the status chip, it landed
            wherever those happened to break, so no two cards lined up. */}
        <div className="mt-0.5 flex items-start gap-1.5 md:mt-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`font-display text-meta uppercase leading-tight tracking-tight ${
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
                  {formatDistance(activityKind(log?.sportType), log?.miles) ?? ""}
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
            {FEELS.map((f) => {
              const picked = log?.feel === f.value;
              return (
                <button
                  key={f.value}
                  title={FEEL_LABEL[f.value]}
                  aria-label={FEEL_LABEL[f.value]}
                  aria-pressed={picked}
                  onClick={() => onFeel(f.value)}
                  // Grey and unringed until you reach for it: hovering colours
                  // the one under the cursor, so the three stay tellable apart
                  // before anything is chosen as well as after.
                  className={`focus-pouf group rounded-full border-2 p-0.5 transition ${f.hover} ${
                    picked
                      ? `${f.on} border-outline`
                      : "border-transparent hover:border-outline"
                  }`}
                >
                  <MoodIcon
                    mood={f.value}
                    size={22}
                    className={`transition ${
                      picked
                        ? ""
                        : "opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-auto hidden pt-1 md:block">
          {renderActions(desktopMenuRef)}
        </div>
      </div>

      {editing && (
        <form
          ref={formRef}
          className="absolute left-0 top-full z-20 mt-1 flex w-48 flex-col gap-1 rounded-sm border-2 border-outline bg-surface p-2 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            onLog(
              distanceUnit && miles
                ? distanceUnit === "yd"
                  ? yardsToMiles(parseFloat(miles))
                  : parseFloat(miles)
                : undefined,
              time ? parseDuration(time) : undefined,
              workoutSportType(workout)
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
          {/* A swim is scheduled in yards and a ride in miles, so the box
              asks for whatever the workout is actually measured in. */}
          {distanceUnit && (
            <input
              type="number"
              step={distanceUnit === "yd" ? "25" : "0.01"}
              min="0"
              placeholder={
                distanceUnit === "yd"
                  ? "Yards swum"
                  : workoutTracksRunningMiles(workout)
                    ? "Running miles"
                    : "Miles ridden"
              }
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              className="focus-pouf rounded-sm border-2 border-outline px-2 py-1 text-meta tabular-nums"
            />
          )}
          <DurationInput value={time} onChange={setTime} />
          <span className="text-meta leading-tight text-ink-soft">
            {distanceUnit
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

function rowSummary(
  row: CalendarRow,
  plan: Plan,
  extraByIso: Map<string, SyncedRun[]>
) {
  let done = 0;
  let total = 0;
  let miles = 0;
  for (const cell of row.cells) {
    if (!cell || cell.workout.type === "rest") continue;
    // Stood-down days are not owed, so they stay out of the tally rather than
    // sitting in it permanently unmet.
    if (isPausedOn(plan, cell.iso) && !plan.logs[cell.key]?.completed) continue;
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
  for (let i = 0; i < 7; i++) {
    const iso = toLocalISO(addDays(row.start, i));
    for (const run of extraByIso.get(iso) ?? []) {
      // Running only, like the plan cells above and every other mileage in the
      // app: a week whose one activity was a 20 mile ride ran no miles.
      if (countsAsRunning(run.sportType)) miles += run.miles;
    }
  }
  return { done, total, miles: Math.round(miles * 10) / 10 };
}

/** A synced run outside the plan — or with no plan at all — kept in the log. */
function ExtraRunCard({
  run,
  date,
  isToday,
  onOpen,
  onFeel,
}: {
  run: SyncedRun;
  date: Date;
  isToday: boolean;
  onOpen: () => void;
  onFeel: (feel: Feel) => void;
}) {
  const kind = activityKind(run.sportType);
  // Each sport reads its speed its own way: min/mi, mph, or per 100 yards.
  const speed = formatSpeed(kind, run.miles, run.seconds);
  const showDistance = tracksDistance(kind) && run.miles > 0;
  const SportIcon =
    kind === "ride" ? BikeIcon : kind === "swim" ? SwimIcon : RunIcon;
  return (
    <div
      className={`relative flex w-full gap-3 rounded-sm border-3 border-outline bg-surface p-2.5 text-left text-body shadow-card md:min-h-[112px] md:flex-col md:gap-0 md:p-2 ${
        isToday ? "rotate-[-1.5deg] outline outline-2 outline-offset-2 outline-primary" : ""
      }`}
    >
      <button
        onClick={onOpen}
        title="See splits, route, and heart rate"
        className="absolute inset-0 z-0 rounded-sm transition hover:bg-lilac/60"
        aria-label={`${run.name ?? activityLabel(run.sportType)} — see splits, route, and heart rate`}
      />
      <div className="pointer-events-none relative z-10 flex shrink-0 items-start pt-0.5 md:hidden">
        <SportIcon size={50} />
      </div>
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-meta font-bold uppercase tracking-wide text-ink-soft">
            <span className="md:hidden">
              {date.toLocaleDateString(undefined, { weekday: "short" })}{" "}
            </span>
            {date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-meta font-bold text-orange-700">
            <BoltIcon size={11} />
            {kind === "run" ? "Run log" : activityLabel(run.sportType)}
          </span>
        </div>
        <div className="mt-0.5 flex items-start gap-1.5 md:mt-1">
          <span
            className="min-w-0 flex-1 truncate font-display text-meta uppercase leading-tight tracking-tight"
            title={run.name}
          >
            {run.name ?? activityLabel(run.sportType)}
          </span>
          <span className="-mr-0.5 hidden shrink-0 self-start md:block">
            <SportIcon size={34} />
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-meta tabular-nums text-ink-soft">
          <span>
            {showDistance && `${formatDistance(kind, run.miles)} · `}
            {formatDurationShort(run.seconds)}
          </span>
          {speed && (
            <span className="font-bold text-primary underline underline-offset-2">
              {speed}
            </span>
          )}
        </div>

        {/* Rating sits above the open-card overlay so it stays clickable. */}
        <div
          className="pointer-events-auto mt-1 flex items-center gap-0.5"
          aria-label="How did it feel?"
        >
          {FEELS.map((f) => {
            const picked = run.feel === f.value;
            return (
              <button
                key={f.value}
                title={FEEL_LABEL[f.value]}
                aria-label={FEEL_LABEL[f.value]}
                aria-pressed={picked}
                onClick={() => onFeel(f.value)}
                className={`focus-pouf group rounded-full border-2 p-0.5 transition ${f.hover} ${
                  picked
                    ? `${f.on} border-outline`
                    : "border-transparent hover:border-outline"
                }`}
              >
                <MoodIcon
                  mood={f.value}
                  size={22}
                  className={`transition ${
                    picked
                      ? ""
                      : "opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Today, on a day that has no workout and no logged activity — before the plan
 * begins, after it ends, or off the plan entirely. `buildCalendar` keeps this
 * week for exactly this card's sake, so it has to stand on its own without a
 * workout to hang off. Carries the same tilt and Today badge as a DayCell, so
 * the eye finds the current day the same way in either case.
 */
function TodayPlaceholder({ date, note }: { date: Date; note: string }) {
  return (
    <div className="relative flex rotate-[-1.5deg] gap-3 rounded-sm border-3 border-dashed border-primary bg-highlight p-2.5 text-body shadow-card md:min-h-[112px] md:flex-col md:gap-0 md:p-2">
      <span className="absolute -top-5 right-2 z-10 hidden rounded-full border-2 border-outline bg-ink px-2 py-0.5 text-meta font-bold uppercase tracking-wide text-background md:inline-block">
        Today
      </span>

      <div className="flex shrink-0 items-start pt-0.5 md:hidden">
        <PoodleFaceIcon size={44} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-meta font-bold uppercase tracking-wide text-ink">
            <span className="md:hidden">
              {date.toLocaleDateString(undefined, { weekday: "short" })}{" "}
            </span>
            {date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          {/* The floating badge above is desktop-only; on a phone there is no
              room over the card, so it sits on the meta line instead. */}
          <span className="z-10 ml-auto shrink-0 rounded-full border-2 border-outline bg-ink px-1.5 py-0.5 text-meta font-bold uppercase tracking-wide text-background md:hidden">
            Today
          </span>
        </div>
        <p className="mt-1 font-display uppercase leading-tight text-ink">
          {note}
        </p>
      </div>
    </div>
  );
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
  runs = [],
  onRunFeel,
}: {
  plan: Plan;
  program: Program;
  updatePlan: (updater: (prev: Plan) => Plan) => void;
  /** Every synced run; ones already matched to a plan slot are filtered out. */
  runs?: SyncedRun[];
  /** Rate a synced activity that has no plan slot to carry the rating. */
  onRunFeel?: (activityId: number, feel: Feel) => void;
}) {
  const [mode, setMode] = useState<ViewMode>("week");
  /**
   * Which month the month view is showing. Steps both ways: back over what was
   * actually done, forward into the weeks still to come.
   */
  const [monthAnchor, setMonthAnchor] = useState(() =>
    startOfMonth(startOfToday())
  );
  /**
   * Per-row open/closed overrides in month view. Absent means "use the
   * default", which is open — a month is short enough to read whole, and
   * folding a week away is the exception rather than the starting state.
   */
  const [openRows, setOpenRows] = useState<Record<number, boolean>>({});
  /** The completed day or synced run whose detail sheet is showing, if any. */
  const [detail, setDetail] = useState<
    { kind: "cell"; cell: CalendarCell } | { kind: "run"; run: SyncedRun } | null
  >(null);
  const today = startOfToday();

  // Runs that filled a plan slot already render as that slot's DayCell; the
  // rest are the free run log, grouped by date.
  const extraByIso = useMemo(() => {
    const matched = matchedActivityIds(plan);
    const byIso = new Map<string, SyncedRun[]>();
    for (const run of runs) {
      if (matched.has(run.stravaActivityId)) continue;
      const list = byIso.get(run.date) ?? [];
      list.push(run);
      byIso.set(run.date, list);
    }
    return byIso;
  }, [plan, runs]);

  const rows = useMemo(
    () => buildCalendar(program, plan, Array.from(extraByIso.keys())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [program, plan.startDate, plan.beginWeek, extraByIso]
  );

  const [weekIndex, setWeekIndex] = useState(() => currentRowIndex(rows));
  // Re-anchor on the current week whenever the schedule shifts (or synced runs
  // add rows) rather than stranding the view on week 1.
  const anchor = `${plan.startDate ?? ""}:${plan.beginWeek ?? 1}:${rows.length}`;
  const [anchoredOn, setAnchoredOn] = useState(anchor);
  if (anchoredOn !== anchor) {
    setAnchoredOn(anchor);
    setWeekIndex(currentRowIndex(rows));
  }
  const safeIndex = Math.min(Math.max(weekIndex, 0), Math.max(rows.length - 1, 0));

  const rowHasPassed = (idx: number) =>
    idx < rows.length && addDays(rows[idx].start, 6) < today;

  /**
   * What an empty today should say. Before the plan begins the countdown is
   * the whole answer; after that it is simply a day off the schedule.
   */
  const untilStart = daysUntilStart(plan);
  const emptyTodayNote =
    untilStart === 1
      ? "Training starts tomorrow"
      : untilStart > 1
        ? `Training starts in ${untilStart} days`
        : "Nothing planned today";

  /**
   * How far the month stepper can travel. The calendar spans the plan, every
   * synced activity, and today, so its own ends are the only months worth
   * reaching — past either one there is nothing but empty weeks.
   */
  const monthBounds = useMemo(() => {
    const fallback = startOfMonth(startOfToday());
    if (rows.length === 0) return { first: fallback, last: fallback };
    return {
      first: startOfMonth(rows[0].start),
      last: startOfMonth(addDays(rows[rows.length - 1].start, 6)),
    };
  }, [rows]);

  const isThisMonth =
    monthAnchor.getTime() === startOfMonth(startOfToday()).getTime();

  /**
   * Month view is a list of expanding week rows scoped to one month. Original
   * indices are carried along so the open/closed state and "this week" marker
   * keep pointing at the right row.
   */
  const listRows = useMemo(() => {
    const all = rows.map((r, idx) => ({ r, idx }));
    if (mode !== "month") return all;
    return all.filter(({ r }) => {
      const end = addDays(r.start, 6);
      const hit = (d: Date) =>
        d.getFullYear() === monthAnchor.getFullYear() &&
        d.getMonth() === monthAnchor.getMonth();
      return hit(r.start) || hit(end);
    });
  }, [rows, mode, monthAnchor]);

  const isRowOpen = (idx: number) => openRows[idx] ?? true;

  const toggleRow = (idx: number) =>
    setOpenRows((prev) => ({ ...prev, [idx]: !isRowOpen(idx) }));

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
    onLog: (miles?: number, seconds?: number, sportType?: string) =>
      updatePlan((prev) => ({
        ...prev,
        logs: {
          ...prev.logs,
          [cell.key]: {
            ...prev.logs[cell.key],
            completed: true,
            // Recorded so a swim or a ride counts towards its own discipline
            // rather than being read as running.
            sportType: prev.logs[cell.key]?.sportType ?? sportType,
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

  const renderSlot = (r: CalendarRow, cell: CalendarCell | null, i: number) => {
    const date = addDays(r.start, i);
    const extras = extraByIso.get(toLocalISO(date)) ?? [];
    if (!cell && extras.length === 0) {
      // An empty today still gets a card. It is the one day the runner has to
      // be able to find, and on a phone the spacer below renders nothing at
      // all, so without this the current day is simply absent from the grid.
      if (isSameDay(date, today)) {
        return (
          <TodayPlaceholder
            key={`today-${toLocalISO(date)}`}
            date={date}
            note={emptyTodayNote}
          />
        );
      }
      // Nothing on this day: an empty desktop slot, nothing at all when stacked.
      return <div key={`empty-${i}`} className="hidden md:block" aria-hidden />;
    }
    return (
      <div key={cell?.key ?? `runs-${toLocalISO(date)}`} className="space-y-2">
        {cell && (
          <DayCell
            cell={cell}
            log={plan.logs[cell.key]}
            isToday={isSameDay(cell.date, today)}
            isPast={cell.date < today}
            isPaused={isPausedOn(plan, cell.iso)}
            onOpen={() => setDetail({ kind: "cell", cell })}
            {...makeHandlers(cell)}
          />
        )}
        {extras.map((run) => (
          <ExtraRunCard
            key={run.stravaActivityId}
            run={run}
            date={date}
            isToday={isSameDay(date, today)}
            onOpen={() => setDetail({ kind: "run", run })}
            onFeel={(feel) => onRunFeel?.(run.stravaActivityId, feel)}
          />
        ))}
      </div>
    );
  };

  // No start date yet, so show the program shape, still Monday-first. Synced
  // runs still get a real dated calendar above it once any exist.
  if (!plan.startDate && rows.length === 0) {
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
      {!plan.startDate && (
        <p className="mb-2 rounded-sm border-2 border-outline bg-highlight px-4 py-2 text-meta font-bold text-ink">
          These are your synced activities. Set a race date on the Goals page to
          lay your training program over this calendar.
        </p>
      )}
      {/* Sticky so the way back out of a long plan is always on screen. */}
      <div className="sticky top-14 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 bg-background/90 px-1 py-2 backdrop-blur">
        {/* Month view lays the program over a real month where there is one,
            and over what was actually done where there isn't. */}
        <SegmentedToggle
          options={MODES}
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (m === "week") setWeekIndex(currentRowIndex(rows));
            if (m === "month") setMonthAnchor(startOfMonth(startOfToday()));
          }}
          getLabel={(m) => (m === "week" ? "This week" : "This month")}
        />

        {mode === "month" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonthAnchor((d) => shiftMonth(d, -1))}
              disabled={monthAnchor <= monthBounds.first}
              className="focus-pouf rounded-full border-2 border-outline px-2 py-1 text-sm text-ink-muted transition hover:bg-lilac disabled:opacity-30"
              aria-label="Previous month"
            >
              ◂
            </button>
            <div className="min-w-[9rem] text-center">
              <div className="font-display text-title text-primary-dark">
                {monthAnchor.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div className="text-meta text-ink-soft">
                {monthSummary(monthAnchor, rows, plan, extraByIso)}
              </div>
            </div>
            <button
              onClick={() => setMonthAnchor((d) => shiftMonth(d, 1))}
              disabled={monthAnchor >= monthBounds.last}
              className="focus-pouf rounded-full border-2 border-outline px-2 py-1 text-sm text-ink-muted transition hover:bg-lilac disabled:opacity-30"
              aria-label="Next month"
            >
              ▸
            </button>
            {!isThisMonth && (
              <button
                onClick={() => setMonthAnchor(startOfMonth(startOfToday()))}
                className="focus-pouf rounded-full border-2 border-outline px-3 py-1 text-meta font-bold text-primary-dark hover:bg-lilac"
              >
                Today
              </button>
            )}
          </div>
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
            {row.cells.map((cell, i) => renderSlot(row, cell, i))}
          </div>
        )}

        {detail?.kind === "cell" && plan.logs[detail.cell.key] && (
          <WorkoutDetail
            log={plan.logs[detail.cell.key]}
            kind={activityKind(plan.logs[detail.cell.key]?.sportType)}
            planId={plan.id}
            logKey={detail.cell.key}
            label={detail.cell.workout.label}
            dateLabel={detail.cell.date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            onClose={() => setDetail(null)}
          />
        )}

        {detail?.kind === "run" && (
          <WorkoutDetail
            log={runAsLog(detail.run)}
            kind={activityKind(detail.run.sportType)}
            label={
              activityKind(detail.run.sportType) === "run"
                ? "Synced run"
                : `Synced ${activityLabel(detail.run.sportType).toLowerCase()}`
            }
            dateLabel={fromISO(detail.run.date).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            onClose={() => setDetail(null)}
          />
        )}

        {mode === "month" && (
          <div className="mt-2 space-y-2">
            {listRows.length === 0 && (
              <p className="rounded-sm border-2 border-outline bg-lilac px-4 py-3 text-meta text-ink-muted">
                {plan.startDate
                  ? "Nothing scheduled or logged this month."
                  : "Nothing logged this month."}
              </p>
            )}
            {listRows.map(({ r, idx }) => {
              const s = rowSummary(r, plan, extraByIso);
              const isCurrent = idx === currentRowIndex(rows);
              const rowInPast = rowHasPassed(idx);
              const open = isRowOpen(idx);
              return (
                <div key={r.start.toISOString()}>
                  {/* The whole header is the control, so a long plan can be
                      folded down to twelve lines without leaving the view. */}
                  <button
                    onClick={() => toggleRow(idx)}
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
                    {(s.total > 0 || s.miles > 0) && (
                      <span
                        className={
                          rowInPast && s.total > 0 && s.done < s.total
                            ? "text-accent"
                            : "text-ink-soft"
                        }
                      >
                        {s.total > 0 ? `${s.done}/${s.total} done` : ""}
                        {s.miles > 0
                          ? `${s.total > 0 ? " · " : ""}${s.miles} mi`
                          : ""}
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
                      {r.cells.map((cell, i) => renderSlot(r, cell, i))}
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
