/**
 * Web Mercator projection, matching what Mapbox's Static Images API renders.
 *
 * The static map is fetched with an explicit centre and zoom rather than the
 * `auto` fit, because `auto` picks a viewport the client cannot reproduce. With
 * the centre and zoom decided here, the same maths places an SVG overlay on top
 * of the image and every coordinate lands exactly where the tiles put it.
 */

import { LatLng } from "@/lib/polyline";

/** Mapbox serves 512px tiles, so the world is 512px wide at zoom 0. */
export const TILE_SIZE = 512;

/** Mapbox rejects zooms outside this range. */
const MIN_ZOOM = 0;
const MAX_ZOOM = 22;

/** Latitudes beyond this are outside the Mercator projection. */
const MAX_LAT = 85.05112878;

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  center: LatLng;
  zoom: number;
  width: number;
  height: number;
}

/** Project to the unit square: (0,0) is the north-west corner of the world. */
export function toUnit({ lat, lng }: LatLng): Point {
  const clamped = Math.min(Math.max(lat, -MAX_LAT), MAX_LAT);
  const phi = (clamped * Math.PI) / 180;
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / (2 * Math.PI),
  };
}

function fromUnit({ x, y }: Point): LatLng {
  const n = Math.PI * (1 - 2 * y);
  return {
    lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI,
    lng: x * 360 - 180,
  };
}

/**
 * The centre and zoom that fit `points` into a `width` x `height` image, with
 * `padding` pixels kept clear on every side so the route never touches the edge.
 */
export function fitViewport(
  points: LatLng[],
  width: number,
  height: number,
  padding = 24
): Viewport | null {
  if (points.length === 0) return null;

  const units = points.map(toUnit);
  const minX = Math.min(...units.map((p) => p.x));
  const maxX = Math.max(...units.map((p) => p.x));
  const minY = Math.min(...units.map((p) => p.y));
  const maxY = Math.max(...units.map((p) => p.y));

  const center = fromUnit({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });

  // A treadmill-tight route has almost no span; the floor keeps zoom finite
  // instead of pinning it to the maximum and rendering a single rooftop.
  const spanX = Math.max(maxX - minX, 1e-7);
  const spanY = Math.max(maxY - minY, 1e-7);
  const usableX = Math.max(width - padding * 2, 1);
  const usableY = Math.max(height - padding * 2, 1);

  const zoom = Math.min(
    Math.log2(usableX / (TILE_SIZE * spanX)),
    Math.log2(usableY / (TILE_SIZE * spanY))
  );

  return {
    center,
    zoom: Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM),
    width,
    height,
  };
}

/** Place a coordinate in the viewport's pixel space, origin at its top left. */
export function projectToViewport(point: LatLng, viewport: Viewport): Point {
  const worldSize = TILE_SIZE * 2 ** viewport.zoom;
  const unit = toUnit(point);
  const center = toUnit(viewport.center);
  return {
    x: (unit.x - center.x) * worldSize + viewport.width / 2,
    y: (unit.y - center.y) * worldSize + viewport.height / 2,
  };
}

/** Metres between two coordinates, by the haversine formula. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
