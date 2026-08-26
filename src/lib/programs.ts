export type WorkoutType =
  | "rest"
  | "run"
  | "run-or-cross"
  | "cross"
  | "swim"
  | "bike"
  | "brick"
  | "multi"
  | "race";

export interface Workout {
  type: WorkoutType;
  label: string;
  miles?: number;
  minutes?: number;
  yards?: number;
  sport?: "running" | "triathlon";
}

export interface ProgramWeek {
  week: number;
  days: Workout[];
}

export interface Program {
  id: string;
  name: string;
  author: string;
  weeks: number;
  description: string;
  available: boolean;
  category: "running" | "triathlon";
  raceLabel: string;
  raceDistanceMiles?: number;
  sourceUrl: string;
  sourceLabel: string;
  schedule: ProgramWeek[];
}

const rest = (): Workout => ({ type: "rest", label: "Rest" });

const run = (miles: number, label = `${miles} mi run`): Workout => ({
  type: "run",
  label,
  miles,
});

const runOrCross = (miles: number): Workout => ({
  type: "run-or-cross",
  label: `${miles} mi run or cross`,
  miles,
});

const timedRun = (minutes: number, focus = "easy"): Workout => ({
  type: "run",
  label: `Run ${minutes} min · ${focus}`,
  minutes,
});

const cross = (minutes?: number): Workout => ({
  type: "cross",
  label: minutes ? `Cross-train ${minutes} min` : "Cross-train",
  minutes,
});

const swim = (yards: number, focus = "aerobic"): Workout => ({
  type: "swim",
  label: `Swim ${yards.toLocaleString("en-US")} yd · ${focus}`,
  yards,
});

const bike = (minutes: number, focus = "aerobic"): Workout => ({
  type: "bike",
  label: `Bike ${minutes} min · ${focus}`,
  minutes,
});

const brick = (
  bikeMinutes: number,
  runMinutes: number,
  focus = "easy",
): Workout => ({
  type: "brick",
  label: `Brick · bike ${bikeMinutes} min + run ${runMinutes} min · ${focus}`,
  minutes: bikeMinutes + runMinutes,
});

const swimRun = (
  yards: number,
  runMinutes?: number,
  runLabel = "run intervals",
): Workout => ({
  type: "multi",
  label: `Swim ${yards.toLocaleString("en-US")} yd + ${
    runMinutes ? `run ${runMinutes} min` : runLabel
  }`,
});

const swimBrick = (
  yards: number,
  bikeMinutes: number,
  runMinutes: number,
): Workout => ({
  type: "multi",
  label: `Swim ${yards.toLocaleString("en-US")} yd + brick ${bikeMinutes}/${runMinutes} min`,
});

const runningRace = (label: string, miles: number): Workout => ({
  type: "race",
  label,
  miles,
  sport: "running",
});

const triathlonRace = (label: string): Workout => ({
  type: "race",
  label,
  sport: "triathlon",
});

const week = (number: number, days: Workout[]): ProgramWeek => ({
  week: number,
  days,
});

/**
 * Whether a scheduled workout involves a given sport at all.
 *
 * A brick is a bike and a run, and the multi-sport days are a swim plus one or
 * both of the others, so those days count towards more than one sport. This is
 * what lets a triathlon plan report progress per discipline instead of folding
 * everything into running.
 */
export function workoutIncludes(
  workout: Workout,
  sport: "running" | "cycling" | "swimming"
): boolean {
  const { type } = workout;
  if (type === "rest") return false;
  if (type === "race") {
    // A triathlon race is all three; a running race is only running.
    return workout.sport === "triathlon" || sport === "running";
  }
  if (sport === "running") {
    return (
      type === "run" || type === "run-or-cross" || type === "brick" ||
      type === "multi"
    );
  }
  if (sport === "cycling") return type === "bike" || type === "brick";
  return type === "swim" || type === "multi";
}

/** Yards to miles, for storing a swim alongside every other distance. */
export function yardsToMiles(yards: number): number {
  return yards / 1760;
}

export function milesToYards(miles: number): number {
  return miles * 1760;
}

/**
 * The unit a workout's distance is logged in, or null when it is scheduled by
 * time alone and asking for a distance would be noise.
 */
export function loggableDistanceUnit(workout: Workout): "mi" | "yd" | null {
  if (workout.type === "swim") return "yd";
  if (workout.type === "bike") return "mi";
  return workoutTracksRunningMiles(workout) ? "mi" : null;
}

/**
 * The sport a manually logged workout should be recorded as, so the log knows
 * what filled it just as a synced activity would.
 */
export function workoutSportType(workout: Workout): string | undefined {
  if (workout.type === "swim") return "Swim";
  if (workout.type === "bike") return "Ride";
  return workoutTracksRunningMiles(workout) ? "Run" : undefined;
}

export function workoutTracksRunningMiles(workout: Workout): boolean {
  return (
    workout.type === "run" ||
    workout.type === "run-or-cross" ||
    (workout.type === "race" && workout.sport !== "triathlon")
  );
}

export const halHigdonHalfNovice1: Program = {
  id: "hal-higdon-half-novice-1",
  name: "Half Marathon Novice 1",
  author: "Hal Higdon",
  weeks: 12,
  description:
    "The app's original beginner half-marathon calendar, with four running days, optional run-or-cross sessions, and a 12-mile peak long run.",
  available: true,
  category: "running",
  raceLabel: "Half Marathon",
  raceDistanceMiles: 13.1094,
  sourceUrl:
    "https://www.halhigdon.com/training-programs/half-marathon-training/novice-1-half-marathon/",
  sourceLabel: "Adapted from Hal Higdon's Novice 1 program",
  schedule: [
    week(1, [rest(), run(3), runOrCross(2), run(3), rest(), run(4), cross(60)]),
    week(2, [rest(), run(3), runOrCross(2), run(3), rest(), run(4), cross(60)]),
    week(3, [rest(), run(3.5), runOrCross(2), run(3.5), rest(), run(5), cross(60)]),
    week(4, [rest(), run(3.5), runOrCross(2), run(3.5), rest(), run(5), cross(60)]),
    week(5, [rest(), run(4), runOrCross(2), run(4), rest(), run(6), cross(60)]),
    week(6, [rest(), run(4), runOrCross(2), run(4), rest(), run(7), cross(60)]),
    week(7, [rest(), run(4.5), runOrCross(3), run(4.5), rest(), run(8), cross(60)]),
    week(8, [rest(), run(4.5), runOrCross(3), run(4.5), rest(), run(9), cross(60)]),
    week(9, [rest(), run(5), runOrCross(3), run(5), rest(), run(10), cross(60)]),
    week(10, [rest(), run(5), runOrCross(3), run(5), rest(), run(11), cross(60)]),
    week(11, [rest(), run(5), runOrCross(3), run(5), rest(), run(12), cross(60)]),
    week(12, [
      rest(),
      run(4),
      runOrCross(3),
      run(2),
      rest(),
      rest(),
      runningRace("Half Marathon", 13.1094),
    ]),
  ],
};

const halfNovice2: Program = {
  id: "hal-higdon-half-novice-2",
  name: "Half Marathon Novice 2",
  author: "Hal Higdon",
  weeks: 12,
  description:
    "A step up from Novice 1 with pace runs, two tune-up races, and a 12-mile peak long run.",
  available: true,
  category: "running",
  raceLabel: "Half Marathon",
  raceDistanceMiles: 13.1094,
  sourceUrl:
    "https://www.halhigdon.com/training-programs/half-marathon-training/novice-2-half-marathon/",
  sourceLabel: "Official Hal Higdon schedule",
  schedule: [
    week(1, [rest(), run(3), run(3), run(3), rest(), run(4), cross(60)]),
    week(2, [rest(), run(3), run(3, "3 mi pace"), run(3), rest(), run(5), cross(60)]),
    week(3, [rest(), run(3), run(4), run(3), rest(), run(6), cross(60)]),
    week(4, [rest(), run(3), run(4, "4 mi pace"), run(3), rest(), run(7), cross(60)]),
    week(5, [rest(), run(3), run(4), run(3), rest(), run(8), cross(60)]),
    week(6, [
      rest(),
      run(3),
      run(4, "4 mi pace"),
      run(3),
      rest(),
      runningRace("5K race", 3.1069),
      cross(60),
    ]),
    week(7, [rest(), run(3), run(5), run(3), rest(), run(9), cross(60)]),
    week(8, [rest(), run(3), run(5, "5 mi pace"), run(3), rest(), run(10), cross(60)]),
    week(9, [
      rest(),
      run(3),
      run(5),
      run(3),
      rest(),
      runningRace("10K race", 6.2137),
      cross(60),
    ]),
    week(10, [rest(), run(3), run(5, "5 mi pace"), run(3), rest(), run(11), cross(60)]),
    week(11, [rest(), run(3), run(5), run(3), rest(), run(12), cross(60)]),
    week(12, [
      rest(),
      run(3),
      run(2, "2 mi pace"),
      run(2),
      rest(),
      rest(),
      runningRace("Half Marathon", 13.1094),
    ]),
  ],
};

const tenKNovice: Program = {
  id: "hal-higdon-10k-novice",
  name: "10K Novice",
  author: "Hal Higdon",
  weeks: 8,
  description:
    "An approachable 10K plan with three runs, two easy cross-training sessions, and two rest days each week.",
  available: true,
  category: "running",
  raceLabel: "10K",
  raceDistanceMiles: 6.2137,
  sourceUrl:
    "https://www.halhigdon.com/training-programs/10k-training/novice-10k/",
  sourceLabel: "Official Hal Higdon schedule",
  schedule: [
    week(1, [rest(), run(2.5), cross(30), run(2), rest(), cross(40), run(3)]),
    week(2, [rest(), run(2.5), cross(30), run(2), rest(), cross(40), run(3.5)]),
    week(3, [rest(), run(2.5), cross(35), run(2), rest(), cross(50), run(4)]),
    week(4, [rest(), run(3), cross(35), run(2), rest(), cross(50), run(4)]),
    week(5, [rest(), run(3), cross(40), run(2), rest(), cross(60), run(4.5)]),
    week(6, [rest(), run(3), cross(40), run(2), rest(), cross(60), run(5)]),
    week(7, [rest(), run(3), cross(45), run(2), rest(), cross(60), run(5.5)]),
    week(8, [
      rest(),
      run(3),
      cross(30),
      run(2),
      rest(),
      rest(),
      runningRace("10K", 6.2137),
    ]),
  ],
};

const marathonNovice1: Program = {
  id: "hal-higdon-marathon-novice-1",
  name: "Marathon Novice 1",
  author: "Hal Higdon",
  weeks: 18,
  description:
    "Hal Higdon's classic first-marathon plan, building through a half-marathon tune-up and a 20-mile peak long run.",
  available: true,
  category: "running",
  raceLabel: "Marathon",
  raceDistanceMiles: 26.2188,
  sourceUrl:
    "https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/",
  sourceLabel: "Official Hal Higdon schedule",
  schedule: [
    week(1, [rest(), run(3), run(3), run(3), rest(), run(6), cross()]),
    week(2, [rest(), run(3), run(3), run(3), rest(), run(7), cross()]),
    week(3, [rest(), run(3), run(4), run(3), rest(), run(5), cross()]),
    week(4, [rest(), run(3), run(4), run(3), rest(), run(9), cross()]),
    week(5, [rest(), run(3), run(5), run(3), rest(), run(10), cross()]),
    week(6, [rest(), run(3), run(5), run(3), rest(), run(7), cross()]),
    week(7, [rest(), run(3), run(6), run(3), rest(), run(12), cross()]),
    week(8, [
      rest(),
      run(3),
      run(6),
      run(3),
      rest(),
      rest(),
      runningRace("Half Marathon tune-up", 13.1094),
    ]),
    week(9, [rest(), run(3), run(7), run(4), rest(), run(10), cross()]),
    week(10, [rest(), run(3), run(7), run(4), rest(), run(15), cross()]),
    week(11, [rest(), run(4), run(8), run(4), rest(), run(16), cross()]),
    week(12, [rest(), run(4), run(8), run(5), rest(), run(12), cross()]),
    week(13, [rest(), run(4), run(9), run(5), rest(), run(18), cross()]),
    week(14, [rest(), run(5), run(9), run(5), rest(), run(14), cross()]),
    week(15, [rest(), run(5), run(10), run(5), rest(), run(20), cross()]),
    week(16, [rest(), run(5), run(8), run(4), rest(), run(12), cross()]),
    week(17, [rest(), run(4), run(6), run(3), rest(), run(8), cross()]),
    week(18, [
      rest(),
      run(3),
      run(4),
      run(2),
      rest(),
      rest(),
      runningRace("Marathon", 26.2188),
    ]),
  ],
};

const sprintTriathlon: Program = {
  id: "triathlete-sprint-beginner",
  name: "Sprint Triathlon Beginner",
  author: "Triathlete",
  weeks: 8,
  description:
    "An abbreviated in-app calendar for Triathlete's first-timer plan, progressing from easy single-sport sessions to race-specific bricks.",
  available: true,
  category: "triathlon",
  raceLabel: "Sprint Triathlon",
  sourceUrl:
    "https://www.triathlete.com/training/getting-started/8-week-sprint-triathlon-training-plan-beginners/",
  sourceLabel: "Adapted from Triathlete's 8-week plan",
  schedule: [
    week(1, [
      rest(),
      swim(400, "easy"),
      timedRun(25, "run/walk"),
      bike(30, "easy"),
      rest(),
      swim(500, "easy"),
      timedRun(30, "run/walk"),
    ]),
    week(2, [
      rest(),
      swim(600, "easy"),
      bike(30, "easy"),
      timedRun(20, "easy intervals"),
      rest(),
      swim(600, "easy"),
      bike(45, "rolling"),
    ]),
    week(3, [
      rest(),
      swim(600, "steady"),
      timedRun(20, "rolling"),
      bike(55, "steady"),
      rest(),
      swim(700, "steady"),
      timedRun(30, "easy"),
    ]),
    week(4, [
      rest(),
      swim(900, "steady"),
      timedRun(40, "rolling"),
      bike(70, "rolling"),
      rest(),
      swim(1000, "steady"),
      brick(45, 20),
    ]),
    week(5, [
      rest(),
      swim(800, "steady"),
      timedRun(40, "rolling"),
      bike(80, "rolling"),
      rest(),
      swim(1000, "steady"),
      brick(60, 20),
    ]),
    week(6, [
      rest(),
      swim(1000, "steady"),
      timedRun(35, "race efforts"),
      bike(60, "race efforts"),
      rest(),
      swim(1000, "fast intervals"),
      brick(40, 20, "race efforts"),
    ]),
    week(7, [
      rest(),
      swim(1000, "race efforts"),
      timedRun(35, "race efforts"),
      bike(60, "race efforts"),
      rest(),
      swim(1000, "race efforts"),
      brick(30, 15, "race efforts"),
    ]),
    week(8, [
      rest(),
      swim(700, "race tune-up"),
      timedRun(20, "race tune-up"),
      bike(30, "race tune-up"),
      rest(),
      bike(15, "easy spin"),
      triathlonRace("Sprint Triathlon"),
    ]),
  ],
};

const olympicTriathlon: Program = {
  id: "triathlete-olympic-beginner",
  name: "Olympic Triathlon Beginner",
  author: "Triathlete",
  weeks: 16,
  description:
    "A compact calendar based on Triathlete's low-volume first-Olympic plan, with progressive swims, rides, runs, bricks, and a sprint tune-up.",
  available: true,
  category: "triathlon",
  raceLabel: "Olympic Triathlon",
  sourceUrl:
    "https://www.triathlete.com/training/olympic-triathlon-16-week-training-plan/",
  sourceLabel: "Adapted from Triathlete's 16-week plan",
  schedule: [
    week(1, [rest(), swim(800), bike(30), timedRun(25), swim(800), bike(30), timedRun(25)]),
    week(2, [rest(), swim(900), bike(45), timedRun(30), swim(900), brick(45, 10), timedRun(30)]),
    week(3, [rest(), swim(1000), bike(60), timedRun(35), swim(1000, "fartlek"), bike(60), timedRun(35)]),
    week(4, [rest(), swim(800), bike(45, "hills"), timedRun(30, "fartlek"), swim(900, "fartlek"), brick(30, 10), timedRun(30)]),
    week(5, [rest(), swim(1100), bike(50, "hills"), timedRun(30, "fartlek"), swim(1100, "fartlek"), bike(60), timedRun(40)]),
    week(6, [rest(), swim(1200), bike(55, "hills"), timedRun(35, "fartlek"), swim(1100, "fartlek"), brick(60, 10), timedRun(45)]),
    week(7, [rest(), swim(1275, "speed"), bike(60, "hills"), timedRun(32, "intervals"), swim(1200, "threshold"), bike(75), timedRun(50)]),
    week(8, [rest(), swim(1000, "speed"), bike(60, "intervals"), timedRun(32, "intervals"), swim(900, "threshold"), brick(60, 10), timedRun(45)]),
    week(9, [rest(), swim(1350, "speed"), bike(65, "hills"), timedRun(34, "intervals"), swim(1400, "threshold"), bike(75), timedRun(55)]),
    week(10, [rest(), swim(1350, "speed"), bike(75, "intervals"), timedRun(36, "intervals"), swim(1400, "threshold"), brick(60, 20), timedRun(40)]),
    week(11, [rest(), swim(1350, "speed"), bike(70, "hills"), timedRun(40, "intervals"), swim(1400, "threshold"), bike(90), timedRun(65, "long")]),
    week(12, [rest(), swim(1100, "speed"), bike(45, "tempo"), timedRun(30, "tempo"), swim(1200, "threshold"), bike(20, "recovery"), triathlonRace("Sprint Triathlon tune-up")]),
    week(13, [rest(), swim(1500, "speed"), bike(55, "tempo"), timedRun(32, "tempo"), swim(1500, "threshold"), bike(105, "long"), timedRun(65, "long")]),
    week(14, [rest(), swim(1500, "speed"), bike(55, "tempo"), timedRun(32, "tempo"), swim(1500, "threshold"), bike(105, "long"), timedRun(65, "long")]),
    week(15, [rest(), swim(1500, "speed"), bike(65, "tempo"), timedRun(36, "tempo"), swim(1500, "threshold"), bike(120, "long"), timedRun(65, "long")]),
    week(16, [rest(), swim(1100, "race tune-up"), bike(45, "tempo"), timedRun(30, "tempo"), swim(900, "race tune-up"), bike(20, "recovery"), triathlonRace("Olympic Triathlon")]),
  ],
};

const halfIronman: Program = {
  id: "triathlete-70-3-first-timer",
  name: "70.3 First-Timer",
  author: "Triathlete",
  weeks: 20,
  description:
    "A compact calendar based on Triathlete's first-70.3 plan, covering its base, build, peak, tune-up, and taper phases.",
  available: true,
  category: "triathlon",
  raceLabel: "70.3 Triathlon",
  sourceUrl:
    "https://www.triathlete.com/training/20-week-training-plan-first-70-3-triathlon/",
  sourceLabel: "Adapted from Triathlete's 20-week plan",
  schedule: [
    week(1, [rest(), bike(45, "power"), swimRun(1200, 30), bike(60), swimRun(1200, 35), bike(60), timedRun(40)]),
    week(2, [rest(), bike(50, "power"), swimRun(1300, 30), bike(60), swimRun(1300, 35), brick(45, 10), swimRun(1600, 40)]),
    week(3, [rest(), bike(50, "power"), swimRun(1400, 35), bike(60), swimRun(1400, 40), bike(75), swimRun(1700, 45)]),
    week(4, [rest(), bike(45, "power"), swimRun(1000, 30), bike(30, "recovery"), swimRun(1200, 35), bike(45), swim(1400, "recovery")]),
    week(5, [rest(), bike(55, "hills"), swimRun(1450, 39), bike(60), swimRun(1600, 40), bike(90), brick(90, 50)]),
    week(6, [rest(), bike(60, "hills"), swimRun(1575, 42), bike(75), swimRun(1700, 40), brick(45, 15), swimRun(1400, 25)]),
    week(7, [rest(), bike(65, "hills"), swimRun(1700, 42), bike(75), swimRun(1750, 40), bike(105), swim(2000)]),
    week(8, [rest(), bike(55, "hills"), swimRun(1250, 39), bike(45), swimRun(1600, 35), bike(60), swimBrick(1600, 45, 15)]),
    week(9, [rest(), bike(60, "hills"), swimRun(1750, 32), bike(75), swimRun(1800, 45), bike(120, "long"), swimRun(2100, 60)]),
    week(10, [rest(), bike(60, "intervals"), swimRun(1825, 34), bike(90), swimRun(1900, 45), brick(60, 20), swimRun(2300, 30)]),
    week(11, [rest(), bike(65, "hills"), swimRun(1900, 36), bike(90), swimRun(2000, 45), bike(135, "long"), swimRun(2150, 65)]),
    week(12, [rest(), bike(60, "intervals"), swimRun(1400, 32), bike(75), swimRun(1600, 35), bike(20, "recovery"), triathlonRace("Sprint Triathlon tune-up")]),
    week(13, [rest(), bike(70, "hills"), swimRun(1900), bike(90), swimRun(2100, 45), bike(150, "long"), swimRun(2300, 70)]),
    week(14, [rest(), bike(75, "intervals"), swimRun(2000, 40), bike(90), swimRun(2100, 50), bike(105), swimBrick(2400, 75, 30)]),
    week(15, [rest(), bike(60, "tempo"), swimRun(2100, 36), bike(90), swimRun(2100, 50), bike(165, "long"), swimRun(2500, 80)]),
    week(16, [rest(), bike(55, "tempo"), swimRun(1600, 34), bike(60), swimRun(1400, 50), bike(20, "recovery"), triathlonRace("Olympic Triathlon tune-up")]),
    week(17, [rest(), bike(65, "tempo"), swimRun(2100, 36), bike(90), swimRun(2100, 55), bike(180, "long"), swimRun(2500, 90)]),
    week(18, [rest(), bike(70, "tempo"), swimRun(2100, 38), bike(105), swimRun(2100, 60), brick(105, 45), swimRun(2512, 30)]),
    week(19, [rest(), bike(75, "tempo"), swimRun(2100, 40), bike(90), swimRun(2100, 55), bike(135, "long"), swimRun(2000, 65)]),
    week(20, [rest(), bike(60, "tempo"), swimRun(1700, 32), bike(45), swim(1100, "race tune-up"), swim(1100, "race tune-up"), triathlonRace("70.3 Triathlon")]),
  ],
};

const halfIntermediate1: Program = {
  id: "hal-higdon-half-intermediate-1",
  name: "Half Marathon Intermediate 1",
  author: "Hal Higdon",
  weeks: 12,
  description: "Adds pace work and longer mileage. Coming soon.",
  available: false,
  category: "running",
  raceLabel: "Half Marathon",
  raceDistanceMiles: 13.1094,
  sourceUrl:
    "https://www.halhigdon.com/training-programs/half-marathon-training/intermediate-1-half-marathon/",
  sourceLabel: "Official Hal Higdon program",
  schedule: [],
};

export const programs: Program[] = [
  halHigdonHalfNovice1,
  halfNovice2,
  tenKNovice,
  marathonNovice1,
  sprintTriathlon,
  olympicTriathlon,
  halfIronman,
  halfIntermediate1,
];

export function getProgram(id: string): Program {
  return programs.find((program) => program.id === id) ?? halHigdonHalfNovice1;
}

export function totalPlannedMiles(program: Program): number {
  return program.schedule.reduce(
    (sum, programWeek) =>
      sum +
      programWeek.days.reduce(
        (weekTotal, workout) =>
          weekTotal +
          (workout.type === "run" ? workout.miles ?? 0 : 0),
        0,
      ),
    0,
  );
}

/**
 * The disciplines a program actually schedules. A triathlon plan is three
 * sports from the first day, whether or not anything has been logged yet, so
 * its progress view should offer all three.
 */
export function programSports(
  program: Program
): ("running" | "cycling" | "swimming")[] {
  const sports = (["running", "cycling", "swimming"] as const).filter((sport) =>
    program.schedule.some((week) =>
      week.days.some((day) => workoutIncludes(day, sport))
    )
  );
  return [...sports];
}
