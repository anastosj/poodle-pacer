"use client";

import confetti from "canvas-confetti";
import { Workout } from "@/lib/programs";

export type CelebrationKind = "workout" | "longrun" | "race";

export function celebrationKind(workout: Workout): CelebrationKind {
  if (workout.type === "race") return "race";
  if (workout.type === "run" && (workout.miles ?? 0) >= 5) return "longrun";
  return "workout";
}

const COLORS = ["#2f6fed", "#93b4f8", "#fdfcf9", "#f19bb4"];

export function celebrate(kind: CelebrationKind = "workout") {
  if (kind === "race") {
    confetti({ particleCount: 220, spread: 130, origin: { y: 0.6 }, colors: COLORS });
    setTimeout(
      () =>
        confetti({
          particleCount: 140,
          spread: 100,
          origin: { y: 0.6, x: 0.25 },
          colors: COLORS,
        }),
      250
    );
    setTimeout(
      () =>
        confetti({
          particleCount: 140,
          spread: 100,
          origin: { y: 0.6, x: 0.75 },
          colors: COLORS,
        }),
      500
    );
  } else if (kind === "longrun") {
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.7 }, colors: COLORS });
  } else {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: COLORS });
  }
}
