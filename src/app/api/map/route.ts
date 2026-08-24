import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { simplifyToLength } from "@/lib/polyline";

export const runtime = "nodejs";

/**
 * Renders a run's route on a real map, via Mapbox's Static Images API.
 *
 * This proxies rather than letting the browser call Mapbox directly, so the
 * token never reaches the client and cannot be lifted from a page source.
 * Requests are signed-in only and the upstream URL is built here from a fixed
 * template, so this cannot be used as an open proxy for arbitrary Mapbox calls.
 */

/** Mapbox caps the request URL; leave room for the style, size and token. */
const MAX_POLYLINE = 6000;
const STYLE = "mapbox/outdoors-v12";
const STROKE = "3f7ef5";

/**
 * A client-supplied viewport, or null when absent or malformed. Values are
 * re-parsed as numbers here so nothing from the query string reaches the
 * upstream URL verbatim.
 */
function parseView(
  center: string | null,
  zoom: string | null
): { lng: number; lat: number; zoom: number } | null {
  if (!center || !zoom) return null;
  const [lng, lat] = center.split(",").map(Number);
  const z = Number(zoom);
  if (![lng, lat, z].every(Number.isFinite)) return null;
  if (Math.abs(lat) > 85 || Math.abs(lng) > 180 || z < 0 || z > 22) return null;
  return {
    lng: Number(lng.toFixed(6)),
    lat: Number(lat.toFixed(6)),
    zoom: Number(z.toFixed(3)),
  };
}

export async function GET(request: NextRequest) {
  if (!currentUserId()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const polyline = params.get("polyline");
  const view = parseView(params.get("center"), params.get("zoom"));
  if (!polyline && !view) {
    return NextResponse.json({ error: "missing_route" }, { status: 400 });
  }

  const clamp = (raw: string | null, fallback: number, max: number) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), max) : fallback;
  };
  const width = clamp(params.get("w"), 640, 1280);
  const height = clamp(params.get("h"), 400, 1280);

  // The replay draws its own trail in SVG, so it asks for bare tiles.
  const overlay =
    polyline && params.get("path") !== "0"
      ? `/path-4+${STROKE}-0.9(${encodeURIComponent(
          simplifyToLength(polyline, MAX_POLYLINE)
        )})`
      : "";
  // An explicit viewport is what lets the client project onto the image; `auto`
  // frames the route for us but never says where it ended up.
  const viewport = view
    ? `${view.lng},${view.lat},${view.zoom}/${width}x${height}@2x`
    : `auto/${width}x${height}@2x?padding=28&`;
  const url =
    `https://api.mapbox.com/styles/v1/${STYLE}/static${overlay}` +
    `/${viewport}${view ? "?" : ""}access_token=${token}`;

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "mapbox_error", status: upstream.status },
      { status: 502 }
    );
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      // The route for a finished run never changes, so let the browser keep it.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
