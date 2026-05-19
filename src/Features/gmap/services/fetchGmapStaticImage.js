// HD satellite static-image capture.
//
// The webhook (appConfig.features.gmap.staticImage) proxies the Google Maps
// Static API server-side so the Static Maps *server* key never reaches the
// client. We send the capture params; the webhook returns the PNG.
//
// meterByPx and latLng are NOT trusted from the server — they are recomputed
// here, locally, from the exact same params we send. The Google Static Maps
// projection is plain Web Mercator, so this is fully deterministic.

const TILE_SIZE = 256;

// Capture defaults. Google Static Maps caps `size` at 640; `scale=2` doubles
// the output resolution (1280x1280 px) WITHOUT changing the ground footprint.
export const GMAP_STATIC_SIZE = 640;
export const GMAP_STATIC_SCALE = 2;
export const GMAP_STATIC_MAPTYPE = "satellite";

// Web Mercator world coordinates at zoom 0 (range [0, 256]).
function project(lat, lng) {
  let siny = Math.sin((lat * Math.PI) / 180);
  siny = Math.min(Math.max(siny, -0.9999), 0.9999);
  return {
    x: TILE_SIZE * (0.5 + lng / 360),
    y: TILE_SIZE * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)),
  };
}

function unproject(x, y) {
  const lng = (x / TILE_SIZE - 0.5) * 360;
  const E = Math.exp((0.5 - y / TILE_SIZE) * 4 * Math.PI);
  const siny = (E - 1) / (E + 1);
  const lat = (Math.asin(siny) * 180) / Math.PI;
  return { lat, lng };
}

/**
 * Deterministic geo properties of a Google Static Maps capture.
 * Computed locally from the request params — no server round-trip needed.
 *
 * @returns {{ meterByPx:number, latLng:{lat,lng}, bounds:{north,south,east,west} }}
 */
export function computeStaticMapGeo({ lat, lng, zoom, size, scale }) {
  const _size = size ?? GMAP_STATIC_SIZE;
  const _scale = scale ?? GMAP_STATIC_SCALE;

  // Ground resolution (meters per *output* pixel of the returned image).
  const groundResolution =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const meterByPx = groundResolution / _scale;

  // Footprint: `size` logical pixels, centered. scale changes resolution, not
  // coverage, so the world-coordinate half-extent uses the logical size.
  const center = project(lat, lng);
  const halfWorld = _size / 2 / Math.pow(2, zoom);

  const nw = unproject(center.x - halfWorld, center.y - halfWorld);
  const se = unproject(center.x + halfWorld, center.y + halfWorld);

  return {
    meterByPx,
    latLng: { lat, lng },
    bounds: { north: nw.lat, south: se.lat, west: nw.lng, east: se.lng },
  };
}

/**
 * Fetch the HD satellite PNG from the webhook and compute its geo props.
 *
 * @returns {{ file:File, meterByPx:number, latLng:{lat,lng} }}
 */
export default async function fetchGmapStaticImage({
  url,
  method = "POST",
  lat,
  lng,
  zoom,
  size = GMAP_STATIC_SIZE,
  scale = GMAP_STATIC_SCALE,
  maptype = GMAP_STATIC_MAPTYPE,
  jwt,
}) {
  if (!url) throw new Error("Missing gmap.staticImage webhook url (appConfig)");

  const body = { lat, lng, zoom, size, scale, maptype };

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(jwt && { Authorization: `Bearer ${jwt}` }),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Static map fetch failed (${res.status})`);
  }

  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("Webhook response is not an image");
  }

  const file = new File([blob], "gmap-satellite.png", { type: blob.type });
  const { meterByPx, latLng } = computeStaticMapGeo({
    lat,
    lng,
    zoom,
    size,
    scale,
  });

  return { file, meterByPx, latLng };
}
