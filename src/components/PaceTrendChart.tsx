"use client";

import { curveMonotoneX } from "@visx/curve";
import { Grid } from "@/components/charts/grid";
import { Line, LineChart } from "@/components/charts/line-chart";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import {
  ActivityKind,
  distanceLabel,
  formatSpeed,
  speedLabel,
} from "@/lib/activities";
import { TrendPoint } from "@/lib/insights";
import { formatPacePerMile } from "@/lib/pace";

/**
 * Speed and distance over time, on two independent y-scales.
 *
 * Only points with a recorded pace are plotted: the series renderer draws a
 * continuous path and has no notion of a gap, so a point with distance but no
 * duration would either break the path or invent a pace it does not have.
 * Those are rare — a workout ticked off without a time — and the miles they
 * carry are still counted in the tiles above.
 */
export default function PaceTrendChart({
  points,
  kind,
}: {
  points: TrendPoint[];
  kind: ActivityKind;
}) {
  const data = points
    .filter((p) => p.pace !== undefined)
    .map((p) => ({
      date: p.date,
      label: p.label,
      /*
       * Pace is seconds per mile, so a faster effort is a *smaller* number and
       * would sink toward the axis floor — the opposite of what "improving"
       * should look like. Negating it puts faster on top. Nothing reads this
       * value back: the tooltip formats `pace` below, so the sign never
       * reaches the runner.
       */
      paceInverted: -p.pace!,
      pace: p.pace!,
      miles: p.miles,
      avgHeartRate: p.avgHeartRate,
    }));

  if (data.length < 2) return null;

  const speedOf = (seconds: number) =>
    formatSpeed(kind, 1, seconds) ?? formatPacePerMile(seconds);

  return (
    <div className="mt-2 rounded-sm border-2 border-outline bg-surface">
      <LineChart
        data={data}
        aspectRatio="5 / 2"
        margin={{ top: 24, right: 20, bottom: 28, left: 20 }}
      >
        <Grid horizontal strokeDasharray="3,4" />
        <XAxis numTicks={5} />
        {/*
          * fadeEdges is off on both series: the default fades a line to
          * transparent at each end, which reads as missing data next to the
          * hard 3px borders every other surface in this app wears.
          */}
        <Line
          dataKey="miles"
          yAxisId="right"
          stroke="var(--chart-2)"
          strokeWidth={2}
          curve={curveMonotoneX}
          fadeEdges={false}
        />
        <Line
          dataKey="paceInverted"
          yAxisId="left"
          stroke="var(--chart-line-primary)"
          strokeWidth={3}
          curve={curveMonotoneX}
          fadeEdges={false}
          showMarkers
        />
        <ChartTooltip
          dotVariant="ring"
          rows={(point) => [
            {
              color: "var(--chart-line-primary)",
              label: speedLabel(kind),
              value: speedOf(point.pace as number),
            },
            {
              color: "var(--chart-2)",
              label: distanceLabel(kind),
              value:
                kind === "swim"
                  ? Math.round((point.miles as number) * 1760).toLocaleString(
                      "en-US"
                    )
                  : `${Math.round((point.miles as number) * 10) / 10}`,
            },
            ...(point.avgHeartRate
              ? [
                  {
                    color: "var(--chart-3)",
                    label: "Heart rate",
                    value: `${point.avgHeartRate as number} bpm`,
                  },
                ]
              : []),
          ]}
        />
      </LineChart>
    </div>
  );
}
