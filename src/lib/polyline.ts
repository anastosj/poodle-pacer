/**
 * Google encoded polyline decoding and re-encoding.
 *
 * Strava hands routes over in this format. Placing the decoded coordinates on
 * screen is `mercator.ts`, which has to match how the map tiles are projected.
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
