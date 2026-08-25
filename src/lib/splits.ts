/**
 * First half against second half of a run.
 *
 * Running the back half faster than the front is a negative split, and it is
 * the thing runners look for first when they read back a race.
 */

export interface HalfComparison {
  firstPace: number;
  secondPace: number;
  /** Second half minus first, in seconds per mile. Negative is faster. */
  deltaSeconds: number;
  kind: "negative" | "even" | "positive";
}

/** Under this, the two halves are the same run rather than a real split. */
const EVEN_THRESHOLD = 3;

/**
 * Splits are whole miles, so the halfway point usually falls inside one. That
 * split's time is apportioned by distance rather than assigned to a side,
 * which would hand one half a free minute on an odd-numbered run.
 */
export function compareHalves(
  splits: { miles: number; seconds: number }[]
): HalfComparison | null {
  const total = splits.reduce((sum, s) => sum + s.miles, 0);
  if (splits.length < 2 || total <= 0) return null;

  const half = total / 2;
  let covered = 0;
  let firstMiles = 0;
  let firstSeconds = 0;
  let secondMiles = 0;
  let secondSeconds = 0;

  for (const s of splits) {
    if (s.miles <= 0) continue;
    const intoFirst = Math.max(0, Math.min(s.miles, half - covered));
    const intoSecond = s.miles - intoFirst;
    const perMile = s.seconds / s.miles;
    firstMiles += intoFirst;
    firstSeconds += intoFirst * perMile;
    secondMiles += intoSecond;
    secondSeconds += intoSecond * perMile;
    covered += s.miles;
  }

  if (firstMiles <= 0 || secondMiles <= 0) return null;

  // Rounded here rather than at the point of display, so the gap always equals
  // the difference between the two paces shown. Unrounded, a 9:35.4 and a
  // 9:38.6 display four seconds apart while reporting a three second gap.
  const firstPace = Math.round(firstSeconds / firstMiles);
  const secondPace = Math.round(secondSeconds / secondMiles);
  const deltaSeconds = secondPace - firstPace;

  return {
    firstPace,
    secondPace,
    deltaSeconds,
    kind:
      Math.abs(deltaSeconds) <= EVEN_THRESHOLD
        ? "even"
        : deltaSeconds < 0
          ? "negative"
          : "positive",
  };
}
