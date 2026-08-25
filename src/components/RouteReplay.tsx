"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoutePoint, RouteStreams } from "@/app/api/strava/activity/[id]/streams/route";
import PoodleCyclist from "@/components/PoodleCyclist";
import PoodleRunner from "@/components/PoodleRunner";
import { ActivityKind, formatSpeed } from "@/lib/activities";
import { formatDuration } from "@/lib/pace";
import {
  Viewport,
  distanceMeters,
  fitViewport,
  projectToViewport,
} from "@/lib/mercator";
import { decodePolyline } from "@/lib/polyline";

/** Logical size of the map; the SVG overlay shares it so coordinates line up. */
const MAP_W = 640;
const MAP_H = 380;
const PADDING = 34;

const METERS_PER_MILE = 1609.344;

/** Where the poodle's paws sit within its own 60x44 viewBox. */
const PAWS_X = 28;
const PAWS_Y = 40;

/** Every replay covers the whole run in about this long, whatever its duration. */
const SPRINT_SECONDS = 20;

interface Frame {
  x: number;
  y: number;
  /** Pixels travelled, for revealing the trail behind the poodle. */
  travelled: number;
  miles: number;
  /** True when the route is heading west and the sprite needs flipping. */
  facingLeft: boolean;
  /** Seconds per mile around this moment, or 0 when it cannot be worked out. */
  pace: number;
}

/**
 * Turn a route into evenly-indexed points with a time for each one.
 *
 * Streams give real timings. Without them (a demo run, or a Strava account that
 * will not serve streams) the polyline is spread over the run's duration, which
 * keeps the poodle on the route but at an unvarying pace.
 */
function pointsFromPolyline(
  polyline: string,
  miles: number,
  seconds: number
): RoutePoint[] {
  const coords = decodePolyline(polyline);
  if (coords.length < 2) return [];

  const gaps = coords.map((p, i) =>
    i === 0 ? 0 : distanceMeters(coords[i - 1], p)
  );
  const total = gaps.reduce((a, b) => a + b, 0) || 1;
  const totalMiles = miles || total / METERS_PER_MILE;

  let run = 0;
  return coords.map((p, i) => {
    run += gaps[i];
    const fraction = run / total;
    return {
      lat: p.lat,
      lng: p.lng,
      t: fraction * (seconds || coords.length),
      d: fraction * totalMiles,
    };
  });
}

/** A point on the elevation profile: miles covered, and feet above sea level. */
interface Rise {
  d: number;
  e: number;
}

/**
 * The run's elevation against distance.
 *
 * Strava's altitude stream is the good case. A demo run, or a run whose device
 * recorded no altitude, falls back to the per-mile elevation changes, which
 * gives the same shape at a coarser resolution rather than nothing at all.
 */
function elevationProfile(
  points: RoutePoint[],
  splits: { miles: number; elevationChange: number }[]
): Rise[] {
  const traced = points.filter((p) => p.e !== undefined);
  if (traced.length > 2) {
    return traced.map((p) => ({ d: p.d, e: p.e as number }));
  }
  if (!splits.length) return [];
  const rises: Rise[] = [{ d: 0, e: 0 }];
  let d = 0;
  let e = 0;
  for (const s of splits) {
    d += s.miles;
    e += s.elevationChange;
    rises.push({ d, e });
  }
  return rises;
}

function ElevationChart({
  rises,
  atMiles,
}: {
  rises: Rise[];
  atMiles: number;
}) {
  const W = 640;
  const H = 90;
  const PAD = 6;

  const totalMiles = rises[rises.length - 1].d || 1;
  const lo = Math.min(...rises.map((r) => r.e));
  const hi = Math.max(...rises.map((r) => r.e));
  // A flat run would otherwise divide by zero and draw a line off the top.
  const range = Math.max(hi - lo, 1);

  const x = (d: number) => (d / totalMiles) * W;
  const y = (e: number) => H - PAD - ((e - lo) / range) * (H - PAD * 2);

  const line = rises
    .map((r, i) => `${i === 0 ? "M" : "L"}${x(r.d).toFixed(1)},${y(r.e).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  // Total climb, which is what runners mean by a run's elevation.
  const gain = rises.reduce(
    (sum, r, i) => (i === 0 ? 0 : sum + Math.max(0, r.e - rises[i - 1].e)),
    0
  );

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-meta font-bold uppercase tracking-wide text-ink-soft">
          Elevation
        </h3>
        <span className="text-meta tabular-nums text-ink-soft">
          {Math.round(gain)} ft climbed · {Math.round(hi - lo)} ft range
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block h-20 w-full rounded-sm border-2 border-outline bg-lilac"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Elevation profile, ${Math.round(gain)} feet of climbing`}
      >
        <path d={area} fill="#2f6fed" opacity="0.28" />
        <path
          d={line}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Where the poodle has got to, so the hills line up with the replay. */}
        <line
          x1={x(atMiles)}
          x2={x(atMiles)}
          y1="0"
          y2={H}
          stroke="#0f1330"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/** Index of the last point at or before `elapsed`. */
function seek(points: RoutePoint[], elapsed: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= elapsed) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export default function RouteReplay({
  polyline,
  activityId,
  miles,
  seconds,
  tiles,
  kind = "run",
  splits = [],
}: {
  polyline: string;
  /** Strava id, when there is one to fetch timing streams from. */
  activityId?: number;
  miles: number;
  seconds: number;
  /** Whether a Mapbox token is configured, i.e. whether there are streets. */
  tiles: boolean;
  /** Which sport, so the poodle rides a bike rather than running a ride. */
  kind?: ActivityKind;
  /** Fallback for the elevation profile when there is no altitude stream. */
  splits?: { miles: number; elevationChange: number }[];
}) {
  const [streams, setStreams] = useState<RouteStreams | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activityId) return;
    let cancelled = false;
    fetch(`/api/strava/activity/${activityId}/streams`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: RouteStreams | null) => {
        // No streams is not an error worth showing: the polyline still animates.
        if (!cancelled && json?.points?.length) setStreams(json);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  const points = useMemo(
    () => streams?.points ?? pointsFromPolyline(polyline, miles, seconds),
    [streams, polyline, miles, seconds]
  );

  const duration = points.length ? points[points.length - 1].t : 0;

  const rises = useMemo(
    () => elevationProfile(points, splits),
    [points, splits]
  );

  const view: Viewport | null = useMemo(
    () => fitViewport(points, MAP_W, MAP_H, PADDING),
    [points]
  );

  const geometry = useMemo(() => {
    if (!view || points.length < 2) return null;
    const pixels = points.map((p) => projectToViewport(p, view));
    const cumulative = [0];
    for (let i = 1; i < pixels.length; i++) {
      const dx = pixels[i].x - pixels[i - 1].x;
      const dy = pixels[i].y - pixels[i - 1].y;
      cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
    }
    const path = pixels
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    return { pixels, cumulative, path, length: cumulative[cumulative.length - 1] };
  }, [points, view]);

  // A four-hour marathon and a twenty-minute shakeout both replay in about
  // SPRINT_SECONDS, so the whole shape of the route is always worth watching.
  const multiplier = Math.max(1, duration / SPRINT_SECONDS);

  // Autoplay is a courtesy, not a requirement; readers who asked for less
  // motion get a finished route and a play button.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      setElapsed(duration);
    }
  }, [duration]);

  const frameRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || duration <= 0) return;
    let last = performance.now();
    const tick = (now: number) => {
      const step = ((now - last) / 1000) * multiplier;
      last = now;
      setElapsed((prev) => {
        const next = prev + step;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [playing, multiplier, duration]);

  const frame: Frame | null = useMemo(() => {
    if (!geometry) return null;
    const { pixels, cumulative } = geometry;
    const i = seek(points, elapsed);
    const next = Math.min(i + 1, points.length - 1);
    const span = points[next].t - points[i].t;
    const fraction = span > 0 ? (elapsed - points[i].t) / span : 0;

    const lerp = (a: number, b: number) => a + (b - a) * fraction;
    // A few points ahead, so the sprite does not flip on every GPS wobble.
    const ahead = pixels[Math.min(i + 3, pixels.length - 1)];

    const look = 6;
    const from = points[Math.max(0, i - look)];
    const to = points[Math.min(points.length - 1, i + look)];
    const dMiles = to.d - from.d;
    const dSeconds = to.t - from.t;

    return {
      x: lerp(pixels[i].x, pixels[next].x),
      y: lerp(pixels[i].y, pixels[next].y),
      travelled: lerp(cumulative[i], cumulative[next]),
      miles: lerp(points[i].d, points[next].d),
      facingLeft: ahead.x < pixels[i].x,
      pace: dMiles > 0.01 ? dSeconds / dMiles : 0,
    };
  }, [geometry, points, elapsed]);

  const restart = useCallback(() => {
    setElapsed(0);
    setPlaying(true);
  }, []);

  if (!geometry || !view || !frame) return null;

  const finished = elapsed >= duration;
  const playedPct = duration > 0 ? (elapsed / duration) * 100 : 0;
  const mapSrc =
    `/api/map?center=${view.center.lng.toFixed(6)},${view.center.lat.toFixed(6)}` +
    `&zoom=${view.zoom.toFixed(3)}&w=${MAP_W}&h=${MAP_H}&path=0`;

  const mileMarkers = points.reduce<{ mile: number; x: number; y: number }[]>(
    (acc, p, i) => {
      const mile = acc.length + 1;
      if (p.d >= mile && mile <= Math.floor(points[points.length - 1].d)) {
        acc.push({ mile, x: geometry.pixels[i].x, y: geometry.pixels[i].y });
      }
      return acc;
    },
    []
  );

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-poodle-cream ring-1 ring-poodle-fur">
        {tiles && !tilesFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapSrc}
            alt="Map of the route taken"
            width={MAP_W}
            height={MAP_H}
            className="block h-auto w-full"
            onError={() => setTilesFailed(true)}
          />
        )}
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className={
            tiles && !tilesFailed ? "absolute inset-0 h-full w-full" : "block h-auto w-full"
          }
          role="img"
          aria-label={`Replay of the route run, ${miles} miles`}
        >
          {/* the whole route, faint, so the shape reads before the poodle gets there */}
          <path
            d={geometry.path}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.22"
          />
          {/* the part already run */}
          <path
            d={geometry.path}
            fill="none"
            stroke="#2f6fed"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={geometry.length}
            strokeDashoffset={geometry.length - frame.travelled}
          />
          {mileMarkers.map((m) => (
            <g key={m.mile} opacity={frame.miles >= m.mile ? 1 : 0.4}>
              <circle
                cx={m.x}
                cy={m.y}
                r="8"
                fill="#fdfcf9"
                stroke="#1d4ed8"
                strokeWidth="1.5"
              />
              <text
                x={m.x}
                y={m.y + 3.2}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#1d4ed8"
              >
                {m.mile}
              </text>
            </g>
          ))}
          <circle
            cx={geometry.pixels[0].x}
            cy={geometry.pixels[0].y}
            r="6"
            fill="#fff"
            stroke="#1d4ed8"
            strokeWidth="2.5"
          />
          <g
            transform={`translate(${frame.x}, ${frame.y})`}
            style={{ transition: "none" }}
          >
            <g
              transform={`scale(${frame.facingLeft ? -1 : 1}, 1) translate(${-PAWS_X}, ${-PAWS_Y})`}
            >
              {kind === "ride" ? (
                <PoodleCyclist riding={playing && !finished} />
              ) : (
                <PoodleRunner running={playing && !finished} />
              )}
            </g>
          </g>
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => (finished ? restart() : setPlaying((p) => !p))}
          className="rounded-full bg-headband px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-headband-dark"
        >
          {finished ? "Replay" : playing ? "Pause" : "Play"}
        </button>

        <div className="ml-auto text-xs font-semibold tabular-nums text-foreground/60">
          {frame.miles.toFixed(2)} mi · {formatDuration(Math.round(elapsed))}
          {/* Instantaneous speed, phrased for the sport: /mi, mph, or /100yd. */}
          {frame.pace > 0 &&
            ` · ${formatSpeed(kind, 1, frame.pace) ?? ""}`}
        </div>
      </div>

      {/* The track carries the progress itself: filled behind the handle, pale
          ahead of it, so how far through the run you are reads at a glance
          without watching the poodle. `appearance-none` drops the browser's own
          fill, so the gradient and the handle are both drawn here. */}
      <input
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={0.1}
        value={elapsed}
        onChange={(e) => setElapsed(Number(e.target.value))}
        aria-label="Scrub through the run"
        style={{
          background: `linear-gradient(to right, var(--primary) ${playedPct}%, var(--primary-soft) ${playedPct}%)`,
        }}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-outline
          [&::-webkit-slider-thumb]:bg-surface
          [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-outline [&::-moz-range-thumb]:bg-surface"
      />

      {rises.length > 2 && (
        <ElevationChart rises={rises} atMiles={frame.miles} />
      )}

      <p className="mt-1.5 text-[10px] text-foreground/45">
        {streams
          ? "Replayed at the speed actually recorded, from Strava's GPS trace."
          : "Replayed at an even speed: this activity has no second-by-second trace."}
      </p>
    </div>
  );
}
