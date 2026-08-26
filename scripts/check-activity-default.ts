/**
 * Checks which sport the Progress view opens on.
 * Run with: npx tsx scripts/check-activity-default.ts
 */
import { defaultKind, kindsPresent } from "../src/lib/activities";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`
  );
}

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const run = (daysAgo: number) => ({ sportType: "Run", date: iso(daysAgo) });
const ride = (daysAgo: number) => ({ sportType: "Ride", date: iso(daysAgo) });
const swim = (daysAgo: number) => ({ sportType: "Swim", date: iso(daysAgo) });

/* A running plan is a commitment to running: it wins whatever else was done. */
check(
  "running plan opens on running, even with more rides logged",
  defaultKind([ride(1), ride(2), ride(3), ride(4), run(30)], true),
  "run"
);

/* No plan, one sport: nothing to decide. */
check("no plan, only rides", defaultKind([ride(1), ride(5)], false), "ride");

/* No plan, a clear favourite. Nine rides to two runs is not a toss-up. */
check(
  "no plan, materially more cycling",
  defaultKind(
    [...Array.from({ length: 9 }, (_, i) => ride(i + 1)), run(3), run(6)],
    false
  ),
  "ride"
);

/* Evenly split: fall back to whatever was done last, which is what someone
   opening the page has most recently in mind. */
check(
  "no plan, evenly split, opens on the latest activity",
  defaultKind([ride(4), ride(5), run(1), run(6)], false),
  "run"
);
check(
  "same, with the ride most recent",
  defaultKind([ride(1), ride(5), run(2), run(6)], false),
  "ride"
);

/* A sport dropped months ago should not still own the view. */
check(
  "a long-abandoned sport does not win on volume",
  defaultKind(
    [...Array.from({ length: 20 }, (_, i) => swim(i + 200)), run(1), ride(9)],
    false
  ),
  "run"
);

/* The toggle should only appear when there is a choice. */
check("one sport offers no choice", kindsPresent([run(1), run(2)]), ["run"]);
check(
  "three sports are offered in a fixed order",
  kindsPresent([swim(1), ride(2), run(3)]),
  ["run", "ride", "swim"]
);
check("nothing logged", kindsPresent([]), []);
check("nothing logged falls back to running", defaultKind([], false), "run");

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
