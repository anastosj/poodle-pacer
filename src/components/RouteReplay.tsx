"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoutePoint, RouteStreams } from "@/app/api/strava/activity/[id]/streams/route";
import PoodleRunner from "@/components/PoodleRunner";
import { formatDuration, formatPace } from "@/lib/pace";
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

/** Whole-run replays: real time, brisk, and "the entire run in 20 seconds". */
const SPRINT_SECONDS = 20;

type SpeedName = "trot" | "run" | "sprint";

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
}: {
  polyline: string;
  /** Strava id, when there is one to fetch timing streams from. */
  activityId?: number;
  miles: number;
  seconds: number;
  /** Whether a Mapbox token is configured, i.e. whether there are streets. */
  tiles: boolean;
}) {
  const [streams, setStreams] = useState<RouteStreams | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [speed, setSpeed] = useState<SpeedName>("sprint");
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

  const multiplier =
    speed === "trot"
      ? 1
      : speed === "run"
        ? 8
        : Math.max(1, duration / SPRINT_SECONDS);

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
            alt="Map of the route run"
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
              <PoodleRunner running={playing && !finished} />
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

        <div className="flex overflow-hidden rounded-full ring-1 ring-poodle-fur">
          {(
            [
              ["trot", "Real time"],
              ["run", "8x"],
              ["sprint", "Whole run"],
            ] as const
          ).map(([name, label]) => (
            <button
              key={name}
              onClick={() => setSpeed(name)}
              aria-pressed={speed === name}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                speed === name
                  ? "bg-headband-light text-headband-dark"
                  : "text-foreground/55 hover:bg-poodle-cream"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs font-semibold tabular-nums text-foreground/60">
          {frame.miles.toFixed(2)} mi · {formatDuration(Math.round(elapsed))}
          {frame.pace > 0 && ` · ${formatPace(Math.round(frame.pace))}/mi`}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={0.1}
        value={elapsed}
        onChange={(e) => setElapsed(Number(e.target.value))}
        aria-label="Scrub through the run"
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-poodle-fur/60 accent-headband"
      />

      <p className="mt-1.5 text-[10px] text-foreground/45">
        {streams
          ? "Replayed at the pace actually run, from Strava's GPS trace."
          : "Replayed at an even pace: this run has no second-by-second trace."}
      </p>
    </div>
  );
}
