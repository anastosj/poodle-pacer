"use client";

import { useState } from "react";
import { DAY_NAMES, Program, Workout } from "@/lib/programs";
import { RunLog, RunnerState, logKey } from "@/lib/store";

const TYPE_STYLES: Record<Workout["type"], string> = {
  rest: "bg-poodle-cream text-foreground/50",
  run: "bg-white",
  "run-or-cross": "bg-white",
  cross: "bg-white",
  race: "bg-headband-light",
};

const TYPE_EMOJI: Record<Workout["type"], string> = {
  rest: "😴",
  run: "🐩",
  "run-or-cross": "🚲",
  cross: "🏊",
  race: "🏅",
};

function todaySlot(startDate?: string): { week: number; dayIndex: number } | null {
  if (!startDate) return null;
  const start = new Date(startDate + "T00:00:00");
  const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
  if (diffDays < 0) return null;
  return { week: Math.floor(diffDays / 7) + 1, dayIndex: diffDays % 7 };
}

function DayCell({
  workout,
  log,
  isToday,
  onToggle,
  onLog,
}: {
  workout: Workout;
  log: RunLog | undefined;
  isToday: boolean;
  onToggle: () => void;
  onLog: (miles?: number, minutes?: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [miles, setMiles] = useState("");
  const [minutes, setMinutes] = useState("");
  const isRest = workout.type === "rest";
  const done = Boolean(log?.completed);

  return (
    <div
      className={`relative flex min-h-[92px] flex-col rounded-2xl p-2 text-xs ring-1 ring-poodle-fur transition ${
        TYPE_STYLES[workout.type]
      } ${done ? "ring-2 ring-headband" : ""} ${
        isToday ? "outline outline-2 outline-offset-2 outline-headband" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-semibold leading-tight">{workout.label}</span>
        <span>{TYPE_EMOJI[workout.type]}</span>
      </div>
      {log?.stravaName && (
        <span className="mt-1 truncate text-[10px] text-[#fc4c02]" title={log.stravaName}>
          ⚡ {log.stravaName}
        </span>
      )}
      {done && (log?.miles || log?.minutes) && (
        <span className="mt-0.5 text-[10px] text-foreground/60">
          {log.miles ? `${log.miles} mi` : ""}
          {log.miles && log.minutes ? " · " : ""}
          {log.minutes ? `${log.minutes} min` : ""}
        </span>
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
            {done ? "Done ✓" : "Mark done"}
          </button>
          <button
            onClick={() => setEditing((e) => !e)}
            className="rounded-full px-2 py-0.5 text-[10px] text-foreground/50 hover:bg-poodle-cream"
            aria-label="Log details"
          >
            ✏️
          </button>
        </div>
      )}
      {editing && (
        <form
          className="absolute left-0 top-full z-10 mt-1 flex w-44 flex-col gap-1 rounded-xl bg-white p-2 ring-1 ring-poodle-fur pouf-shadow"
          onSubmit={(e) => {
            e.preventDefault();
            onLog(
              miles ? parseFloat(miles) : undefined,
              minutes ? parseInt(minutes, 10) : undefined
            );
            setEditing(false);
            setMiles("");
            setMinutes("");
          }}
        >
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Miles"
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            className="rounded-lg border border-poodle-fur px-2 py-1 text-[11px]"
          />
          <input
            type="number"
            min="0"
            placeholder="Minutes"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="rounded-lg border border-poodle-fur px-2 py-1 text-[11px]"
          />
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

export default function WeekGrid({
  state,
  program,
  update,
}: {
  state: RunnerState;
  program: Program;
  update: (updater: (prev: RunnerState) => RunnerState) => void;
}) {
  const today = todaySlot(state.startDate);

  return (
    <div className="mt-6 space-y-4">
      <div className="hidden grid-cols-[64px_repeat(7,1fr)] gap-2 md:grid">
        <div />
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-bold uppercase tracking-wide text-foreground/50"
          >
            {d}
          </div>
        ))}
      </div>
      {program.schedule.map((week) => (
        <div
          key={week.week}
          className="grid grid-cols-2 gap-2 md:grid-cols-[64px_repeat(7,1fr)]"
        >
          <div className="col-span-2 flex items-center text-sm font-extrabold text-headband-dark md:col-span-1 md:justify-center">
            Wk {week.week}
          </div>
          {week.days.map((workout, dayIndex) => {
            const key = logKey(week.week, dayIndex);
            return (
              <DayCell
                key={key}
                workout={workout}
                log={state.logs[key]}
                isToday={
                  today?.week === week.week && today?.dayIndex === dayIndex
                }
                onToggle={() =>
                  update((prev) => ({
                    ...prev,
                    logs: {
                      ...prev.logs,
                      [key]: {
                        ...prev.logs[key],
                        completed: !prev.logs[key]?.completed,
                      },
                    },
                  }))
                }
                onLog={(miles, minutes) =>
                  update((prev) => ({
                    ...prev,
                    logs: {
                      ...prev.logs,
                      [key]: {
                        ...prev.logs[key],
                        completed: true,
                        miles,
                        minutes,
                      },
                    },
                  }))
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
