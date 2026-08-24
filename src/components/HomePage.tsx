"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CalendarGrid from "@/components/CalendarGrid";
import DurationInput from "@/components/DurationInput";
import OnboardingWizard from "@/components/OnboardingWizard";
import StatsBar from "@/components/StatsBar";
import { useApp } from "@/components/AppContext";
import PoodleMascot from "@/components/PoodleMascot";
import WorkoutIcon from "@/components/WorkoutIcon";
import { StarIcon } from "@/components/Icons";
import { celebrate, celebrationKind } from "@/lib/celebrate";
import { planCells } from "@/lib/calendar";
import { fromISO, startOfToday, toLocalISO } from "@/lib/dates";
import { computeInsights, consistencyOf } from "@/lib/insights";
import { formatDuration, parseDuration } from "@/lib/pace";
import {
  daysUntilStart,
  effectiveStartDate,
  makePlan,
  raceDateFromStart,
} from "@/lib/store";

const CHEERS = [
  "Paws on the pavement. You have got this.",
  "Every mile earns extra belly rubs.",
  "Fluffy on the outside, fierce on the inside.",
  "Trot, jog, zoom, repeat!",
  "Race day? That's just a lot of very focused zoomies.",
  "Blue headband on. Game face on.",
];

export default function HomePage() {
  const { state, loaded, plan, program, update, updatePlan } = useApp();
  // Start on a fixed cheer so server and client agree, then shuffle after mount.
  const [cheer, setCheer] = useState(CHEERS[0]);
  const [raceMiles, setRaceMiles] = useState("");
  const [raceTime, setRaceTime] = useState("");
  const [raceNote, setRaceNote] = useState("");
  const [raceResultMessage, setRaceResultMessage] = useState("");
  useEffect(() => {
    setCheer(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  }, []);
  useEffect(() => {
    setRaceMiles(plan.raceResult?.miles?.toString() ?? "");
    setRaceTime(
      plan.raceResult?.seconds === undefined
        ? ""
        : formatDuration(plan.raceResult.seconds)
    );
    setRaceNote(plan.raceResult?.note ?? "");
  }, [
    plan.id,
    plan.raceResult?.miles,
    plan.raceResult?.seconds,
    plan.raceResult?.note,
  ]);

  const countdown = daysUntilStart(plan);
  const effectiveStart = effectiveStartDate(plan);
  const startsOn = effectiveStart ? fromISO(effectiveStart) : null;
  const raceDate = plan.startDate
    ? fromISO(raceDateFromStart(plan.startDate, program.weeks))
    : null;
  const today = fromISO(new Date().toISOString().slice(0, 10));
  const isRaceDay = Boolean(raceDate && raceDate.getTime() === today.getTime());
  const isComplete = Boolean(raceDate && raceDate < today);
  const recap = isComplete ? computeInsights(plan, program, "plan") : null;
  const raceWorkout = program.schedule
    .flatMap((week) => week.days)
    .find((workout) => workout.type === "race");
  const raceLabel = raceWorkout?.label ?? program.name;

  // Today's own cell, from the same builder the calendar grid uses, so the
  // banner and the highlighted column can never disagree.
  const todayCell = useMemo(() => {
    const iso = toLocalISO(startOfToday());
    return planCells(program, plan).find((c) => c.iso === iso) ?? null;
  }, [program, plan]);
  const todayLog = todayCell ? plan.logs[todayCell.key] : undefined;
  const todayDone = todayLog?.completed ?? false;

  // Wait for the server copy, otherwise the wizard flashes over an existing plan.
  const showOnboarding =
    loaded &&
    !state.onboarded &&
    !plan.startDate &&
    Object.keys(plan.logs).length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="type-display">
            {plan.name}
          </h1>
          <p className="type-body text-ink-muted">
            {program.author}&apos;s {program.name}
            {!plan.startDate && (
              <>
                {" · "}
                <Link href="/goals" className="font-bold text-primary underline">
                  set your race date
                </Link>
              </>
            )}
          </p>
        </div>
        <p className="rotate-[1.5deg] rounded-full border-2 border-outline bg-highlight px-4 py-1 text-sm font-bold text-ink shadow-soft">
          {cheer}
        </p>
      </div>

      {countdown > 0 && (
        <section className="mt-5 flex flex-wrap items-center gap-4 rounded-sm border-3 border-outline bg-primary p-5 text-white shadow-hero">
          <div className="flex-1">
            <div className="type-overline text-lilac">
              Countdown
            </div>
            <div className="mt-1 font-display text-title uppercase">
              {countdown} day{countdown === 1 ? "" : "s"} until training starts
            </div>
            <div className="type-body text-white/85">
              {startsOn &&
                `Week 1 begins ${startsOn.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}. Rest up.`}
            </div>
          </div>
          <PoodleMascot size={72} className="wag" />
        </section>
      )}

      {countdown === 0 && todayCell && (
        <section className="mt-5 flex flex-wrap items-center gap-4 rounded-sm border-3 border-outline bg-primary p-5 text-white shadow-hero">
          {/* The same poodle the calendar shows for this session, so the banner
              and today's column read as the same workout. */}
          <WorkoutIcon
            type={todayCell.workout.type}
            size={54}
            className="shrink-0"
            onPrimary
          />
          <div className="flex-1">
            <div className="type-overline flex items-center gap-1.5 text-lilac">
              <StarIcon size={13} />
              Today
            </div>
            <div className="mt-1 font-display text-title uppercase">
              {todayCell.workout.label}
            </div>
            <div className="type-body text-white/85">
              {/* Numbered from this runner's first training day, matching the
                  calendar cells, not from program week 1. */}
              Day {todayCell.dayNumber + 1} ·{" "}
              {todayCell.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}{" "}
              · Week {todayCell.week}
            </div>
          </div>
          {todayCell.workout.type === "rest" ? (
            <p className="rounded-sm border-3 border-outline bg-lilac px-5 py-2 text-sm font-bold uppercase text-ink">
              Rest day
            </p>
          ) : (
            <button
              onClick={() => {
                if (!todayDone) celebrate(celebrationKind(todayCell.workout));
                updatePlan((prev) => ({
                  ...prev,
                  logs: {
                    ...prev.logs,
                    [todayCell.key]: {
                      ...prev.logs[todayCell.key],
                      completed: !todayDone,
                    },
                  },
                }));
              }}
              aria-pressed={todayDone}
              className={`hard-button focus-pouf w-full rounded-sm px-5 py-2 text-sm font-bold uppercase sm:w-auto ${
                todayDone ? "bg-lilac text-ink" : "bg-highlight text-ink"
              }`}
            >
              {todayDone ? "Done" : "Mark done"}
            </button>
          )}
        </section>
      )}

      {isRaceDay && (
        <section className="mt-4 flex flex-wrap items-center gap-4 rounded-pouf bg-headband p-5 text-white pouf-shadow">
          <PoodleMascot size={64} className="wag" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-white/70">
              Race day
            </div>
            <div className="mt-1 text-xl font-extrabold">{raceLabel}</div>
            <p className="text-sm text-white/80">
              Your final scheduled day is here. Have a brilliant run.
            </p>
          </div>
        </section>
      )}

      {isComplete && recap && (
        <section className="mt-4 rounded-pouf bg-poodle-white p-5 ring-1 ring-poodle-fur pouf-shadow">
          <div className="flex items-center gap-3">
            <PoodleMascot size={56} />
            <div>
              <h2 className="text-lg font-extrabold">Plan complete</h2>
              <p className="text-sm text-foreground/60">
                A recap of this training block.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-poodle-cream p-3 text-center">
              <b className="block text-lg text-headband-dark">
                {recap.current.miles}
              </b>
              <span className="text-xs text-foreground/55">total miles</span>
            </div>
            <div className="rounded-xl bg-poodle-cream p-3 text-center">
              <b className="block text-lg text-headband-dark">
                {recap.current.completed}/{recap.current.scheduled}
              </b>
              <span className="text-xs text-foreground/55">workouts</span>
            </div>
            <div className="rounded-xl bg-poodle-cream p-3 text-center">
              <b className="block text-lg text-headband-dark">
                {Math.round(consistencyOf(recap.current) * 100)}%
              </b>
              <span className="text-xs text-foreground/55">consistency</span>
            </div>
            <div className="rounded-xl bg-poodle-cream p-3 text-center">
              <b className="block text-lg text-headband-dark">
                {recap.current.longestRun}
              </b>
              <span className="text-xs text-foreground/55">longest run</span>
            </div>
          </div>
          <form
            className="mt-4 rounded-xl bg-poodle-cream p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const miles = Number(raceMiles);
              const seconds = parseDuration(raceTime);
              if (!Number.isFinite(miles) || miles <= 0) {
                setRaceResultMessage("Enter a race distance.");
                return;
              }
              if (seconds === undefined || seconds <= 0) {
                setRaceResultMessage("Enter a finish time.");
                return;
              }
              updatePlan((p) => ({
                ...p,
                raceResult: {
                  miles,
                  seconds,
                  ...(raceNote.trim() ? { note: raceNote.trim() } : {}),
                },
              }));
              setRaceResultMessage("Race result saved.");
            }}
          >
            <h3 className="text-sm font-bold">Race result</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-xs font-semibold">
                Distance (miles)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={raceMiles}
                  onChange={(event) => setRaceMiles(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-poodle-fur bg-white px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs font-semibold">
                Finish time
                <DurationInput
                  value={raceTime}
                  onChange={setRaceTime}
                  className="mt-1 w-full text-sm"
                  placeholder="hh:mm:ss"
                />
              </label>
              <label className="text-xs font-semibold">
                Note (optional)
                <input
                  type="text"
                  value={raceNote}
                  onChange={(event) => setRaceNote(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-poodle-fur bg-white px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="rounded-full bg-headband px-4 py-2 text-sm font-bold text-white"
              >
                {plan.raceResult ? "Update race result" : "Log race result"}
              </button>
              {raceResultMessage && (
                <span className="text-xs text-foreground/60">
                  {raceResultMessage}
                </span>
              )}
            </div>
          </form>
          {plan.raceResult && (
            <div className="mt-3 rounded-xl bg-headband-light px-4 py-3 text-sm text-headband-dark">
              <div className="font-bold">
                {plan.raceResult.miles ?? "—"} miles
                {plan.raceResult.seconds !== undefined &&
                  ` · ${formatDuration(plan.raceResult.seconds)}`}
              </div>
              {plan.raceResult.note && (
                <p className="mt-1 text-xs">{plan.raceResult.note}</p>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const nextPlan = makePlan("My Next Half Marathon");
                update((prev) => ({
                  ...prev,
                  plans: [...prev.plans, nextPlan],
                  activePlanId: nextPlan.id,
                }));
                window.setTimeout(() => {
                  window.location.href = "/goals";
                }, 700);
              }}
              className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-poodle-fur"
            >
              Start next plan
            </button>
          </div>
        </section>
      )}

      <StatsBar plan={plan} program={program} />

      <CalendarGrid plan={plan} program={program} updatePlan={updatePlan} />

      <p className="mt-6 text-center text-meta text-ink-soft">
        <Link href="/progress" className="font-bold text-primary underline">
          See your full progress
        </Link>
      </p>

      {showOnboarding && <OnboardingWizard />}
    </div>
  );
}
