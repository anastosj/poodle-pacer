/**
 * Google encoded polyline decoding, and projection into an SVG path.
 *
 * Drawing the route shape needs no map provider and no API key. It shows where
 * the run went relative to itself, not which streets it used; street tiles
 * would mean Mapbox or similar, with a token and a bill attached.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Decode Strava's encoded polyline into coordinates. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of ["lat", "lng"] as const) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      // The low bit is the sign, and values are deltas from the previous point.
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === "lat") lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Re-encode coordinates, used to shorten a route that will not fit in a URL. */
export function encodePolyline(points: LatLng[]): string {
  const chunk = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let out = "";
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return out + String.fromCharCode(v + 63);
  };
  let lat = 0;
  let lng = 0;
  let out = "";
  for (const p of points) {
    const la = Math.round(p.lat * 1e5);
    const ln = Math.round(p.lng * 1e5);
    out += chunk(la - lat) + chunk(ln - lng);
    lat = la;
    lng = ln;
  }
  return out;
}

/**
 * Drop intermediate points until the encoded route fits within `maxLength`.
 * Static map URLs are capped, and a long run can encode to several kilobytes.
 * Endpoints are always kept so the route still starts and finishes correctly.
 */
export function simplifyToLength(encoded: string, maxLength: number): string {
  if (encoded.length <= maxLength) return encoded;
  const points = decodePolyline(encoded);
  for (let step = 2; step < 40; step++) {
    const kept = points.filter((_, i) => i % step === 0);
    if (kept[kept.length - 1] !== points[points.length - 1]) {
      kept.push(points[points.length - 1]);
    }
    const out = encodePolyline(kept);
    if (out.length <= maxLength) return out;
  }
  return encodePolyline([points[0], points[points.length - 1]]);
}

/**
 * Project coordinates into an SVG path, fitted to the box with a margin.
 *
 * Longitude degrees shrink towards the poles, so they are scaled by cos(lat)
 * before fitting. Without that a north-south route comes out stretched sideways.
 */
export function polylineToPath(
  points: LatLng[],
  width: number,
  height: number,
  margin = 6
): string | null {
  if (points.length < 2) return null;

  const midLat = (points[0].lat + points[points.length - 1].lat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);

  const xs = points.map((p) => p.lng * lngScale);
  const ys = points.map((p) => -p.lat); // north upwards

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;

  // One scale for both axes keeps the route's proportions honest.
  const scale = Math.min(
    (width - margin * 2) / spanX,
    (height - margin * 2) / spanY
  );

  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return points
    .map((_, i) => {
      const x = (xs[i] - minX) * scale + offsetX;
      const y = (ys[i] - minY) * scale + offsetY;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Start and end markers, in the same projected space as the path. */
export function polylineEndpoints(
  points: LatLng[],
  width: number,
  height: number,
  margin = 6
): { start: [number, number]; end: [number, number] } | null {
  const path = polylineToPath(points, width, height, margin);
  if (!path) return null;
  const coords = path
    .split(" ")
    .map((c) => c.slice(1).split(",").map(Number) as [number, number]);
  return { start: coords[0], end: coords[coords.length - 1] };
}
