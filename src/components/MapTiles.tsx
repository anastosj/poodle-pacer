"use client";

/**
 * Street tiles straight from OpenStreetMap, so a route sits on a real map
 * without anyone having to sign up for anything.
 *
 * The Mapbox proxy in /api/map renders a nicer, better-labelled map, but it
 * needs a token; when one is set it wins. This is the fallback that means the
 * default experience is a map rather than a route floating on a flat panel.
 *
 * OSM's tile policy asks for attribution and no bulk downloading. One screen of
 * tiles per run viewed is well inside that, and the credit is rendered below.
 */

import { TILE_SIZE, Viewport, toUnit } from "@/lib/mercator";

/** OSM serves 256px tiles; the rest of the app projects against Mapbox's 512. */
const OSM_TILE = 256;

/** OSM has no tiles deeper than this. */
const MAX_OSM_ZOOM = 19;

interface Tile {
  key: string;
  url: string;
  left: number;
  top: number;
  size: number;
}

/**
 * The tiles covering a viewport, already positioned in its pixel space.
 *
 * The viewport's zoom is fractional and measured in 512px tiles, so the integer
 * OSM zoom is one step deeper (512 = 256 x 2) and the leftover fraction becomes
 * a scale on each tile. That keeps the tiles in exact register with the SVG
 * overlay, which projects through the same viewport.
 */
function tilesFor(view: Viewport): { tiles: Tile[]; zoom: number } {
  const worldSize = TILE_SIZE * 2 ** view.zoom;
  const zoom = Math.max(0, Math.min(Math.floor(view.zoom + 1), MAX_OSM_ZOOM));
  const tileWorld = OSM_TILE * 2 ** zoom;
  const scale = worldSize / tileWorld;
  const size = OSM_TILE * scale;

  // Top-left of the viewport, in the tile grid's own pixel space.
  const center = toUnit(view.center);
  const leftPx = center.x * tileWorld - view.width / 2 / scale;
  const topPx = center.y * tileWorld - view.height / 2 / scale;

  const count = 2 ** zoom;
  const firstX = Math.floor(leftPx / OSM_TILE);
  const lastX = Math.floor((leftPx + view.width / scale) / OSM_TILE);
  const firstY = Math.floor(topPx / OSM_TILE);
  const lastY = Math.floor((topPx + view.height / scale) / OSM_TILE);

  const tiles: Tile[] = [];
  for (let x = firstX; x <= lastX; x++) {
    for (let y = firstY; y <= lastY; y++) {
      // Rows above or below the world have no tiles; columns wrap around it.
      if (y < 0 || y >= count) continue;
      const wrapped = ((x % count) + count) % count;
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png`,
        left: (x * OSM_TILE - leftPx) * scale,
        top: (y * OSM_TILE - topPx) * scale,
        size,
      });
    }
  }
  return { tiles, zoom };
}

export default function MapTiles({ view }: { view: Viewport }) {
  const { tiles } = tilesFor(view);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden
      // Tiles are the ground the route is drawn on, never the thing you click.
      style={{ pointerEvents: "none" }}
    >
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          className="absolute max-w-none"
          style={{
            left: `${(tile.left / view.width) * 100}%`,
            top: `${(tile.top / view.height) * 100}%`,
            width: `${(tile.size / view.width) * 100}%`,
            height: `${(tile.size / view.height) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
