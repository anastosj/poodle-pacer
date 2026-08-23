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
  if (!polyline) {
    return NextResponse.json({ error: "missing_polyline" }, { status: 400 });
  }

  const clamp = (raw: string | null, fallback: number, max: number) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), max) : fallback;
  };
  const width = clamp(params.get("w"), 640, 1280);
  const height = clamp(params.get("h"), 400, 1280);

  const route = simplifyToLength(polyline, MAX_POLYLINE);
  const overlay = `path-4+${STROKE}-0.9(${encodeURIComponent(route)})`;
  const url =
    `https://api.mapbox.com/styles/v1/${STYLE}/static/${overlay}` +
    `/auto/${width}x${height}@2x?padding=28&access_token=${token}`;

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
