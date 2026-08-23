/** Route maps are optional: without a Mapbox token the app draws the shape instead. */
export function mapsConfigured(): boolean {
  return Boolean(process.env.MAPBOX_TOKEN);
}
