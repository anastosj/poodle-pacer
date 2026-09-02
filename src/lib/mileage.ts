/**
 * The one rule for turning a logged workout into running miles.
 *
 * Every mileage total in the app — the week strip, the month header, the
 * weekly bar chart, personal bests, the race predictor — has to agree, and
 * they only agree if they ask the same question here. The question is not
 * "was this slot a running slot", because a run-or-cross day can just as
 * easily have been filled by an hour of weights or a spin class, and neither
 * of those covered any running ground.
 */
import { countsAsRunning } from "@/lib/activities";
import { Workout, workoutTracksRunningMiles } from "@/lib/programs";
import { RunLog } from "@/lib/store";

/**
 * Whether a completed log is a running effort, and so may set a pace, a
 * personal best, or a race prediction.
 *
 * A log with no sport predates the field, when everything synced was a run.
 */
export function isRunningEffort(log: RunLog | undefined): boolean {
  return Boolean(log?.completed) && countsAsRunning(log?.sportType);
}

/**
 * Running miles credited for a scheduled workout: what was actually logged,
 * falling back to what the program asked for.
 *
 * Three ways to score nothing, in order:
 *  - the slot never tracked running distance at all (a swim, a bike, a
 *    cross-training day);
 *  - the slot does, but something that isn't running filled it — a HIIT class
 *    on a run-or-cross day contributes its time, never its distance;
 *  - the slot is a run-or-cross with no distance recorded, so there is no
 *    honest number to assume.
 */
export function runningMilesFor(
  workout: Workout,
  log: RunLog | undefined
): number {
  if (!log?.completed) return 0;
  if (!workoutTracksRunningMiles(workout)) return 0;
  if (!isRunningEffort(log)) return 0;
  if (typeof log.miles === "number") return log.miles;
  // A run-or-cross day states no distance of its own, so an unrecorded one
  // stays at zero rather than being credited the running option's miles.
  if (workout.type === "run-or-cross") return 0;
  return workout.miles ?? 0;
}
