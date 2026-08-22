export type WorkoutType = "rest" | "run" | "run-or-cross" | "cross" | "race";

export interface Workout {
  type: WorkoutType;
  /** Distance in miles for run workouts */
  miles?: number;
  /** Duration in minutes for cross-training */
  minutes?: number;
  label: string;
}

export interface ProgramWeek {
  week: number;
  days: Workout[]; // Mon..Sun
}

export interface Program {
  id: string;
  name: string;
  author: string;
  weeks: number;
  description: string;
  available: boolean;
  schedule: ProgramWeek[];
}

const rest: Workout = { type: "rest", label: "Rest" };
const run = (miles: number): Workout => ({
  type: "run",
  miles,
  label: `${miles} mi run`,
});
const runOrCross = (miles: number): Workout => ({
  type: "run-or-cross",
  miles,
  label: `${miles} mi run or cross`,
});
const cross = (minutes: number): Workout => ({
  type: "cross",
  minutes,
  label: `${minutes} min cross`,
});
const race: Workout = { type: "race", label: "Half Marathon! 🎉" };

const w = (
  week: number,
  tue: number,
  wed: number,
  thu: number,
  sat: number
): ProgramWeek => ({
  week,
  days: [rest, run(tue), runOrCross(wed), run(thu), rest, run(sat), cross(60)],
});

export const halHigdonHalfNovice1: Program = {
  id: "hal-higdon-half-novice-1",
  name: "Half Marathon Novice 1",
  author: "Hal Higdon",
  weeks: 12,
  available: true,
  description:
    "A 12-week program for first-time half marathoners. Three runs a week, a weekend long run that builds gradually, and plenty of rest.",
  schedule: [
    w(1, 3, 2, 3, 4),
    w(2, 3, 2, 3, 4),
    w(3, 3.5, 2, 3.5, 5),
    w(4, 3.5, 2, 3.5, 5),
    w(5, 4, 2, 4, 6),
    w(6, 4, 2, 4, 7),
    w(7, 4.5, 3, 4.5, 8),
    w(8, 4.5, 3, 4.5, 9),
    w(9, 5, 3, 5, 10),
    w(10, 5, 3, 5, 11),
    w(11, 5, 3, 5, 12),
    {
      week: 12,
      days: [rest, run(4), runOrCross(3), run(2), rest, rest, race],
    },
  ],
};

export const programs: Program[] = [
  halHigdonHalfNovice1,
  {
    id: "hal-higdon-half-novice-2",
    name: "Half Marathon Novice 2",
    author: "Hal Higdon",
    weeks: 12,
    available: false,
    description: "For runners with some experience. Coming soon!",
    schedule: [],
  },
  {
    id: "hal-higdon-half-intermediate-1",
    name: "Half Marathon Intermediate 1",
    author: "Hal Higdon",
    weeks: 12,
    available: false,
    description: "Adds pace work and longer mileage. Coming soon!",
    schedule: [],
  },
];

export function totalPlannedMiles(program: Program): number {
  return program.schedule.reduce(
    (sum, week) =>
      sum + week.days.reduce((s, d) => s + (d.type === "run" ? d.miles ?? 0 : 0), 0),
    0
  );
}
