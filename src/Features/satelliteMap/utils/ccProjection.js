/**
 * Lambert Conformal Conic "CC 9 zones" helpers (RGF93 / CC42 … CC50,
 * EPSG:3942 … EPSG:3950) used by the LAMBERT_CC satellite capture mode.
 *
 * WHY NOT WEB MERCATOR (EPSG:3857)?
 *
 * Web Mercator applies the *spherical* Mercator formulas to *ellipsoidal*
 * (WGS84) latitudes. On the ellipsoid it is therefore NOT conformal: at a
 * given point the east-west ground scale is (N·cosφ)/a·Δx and the
 * north-south ground scale is (M·cosφ)/a·Δy, where N and M are the prime
 * vertical and meridional radii of curvature. Their ratio M/N =
 * (1−e²)/(1−e²·sin²φ) ≈ 0.9971 at φ = 48.7° (Paris): the two axes of a
 * 3857 image differ by ≈ 0.29 %, i.e. ≈ 29 cm over 100 m. A single
 * `meterByPx` can never be exact in both directions for such an image.
 *
 * On top of that, the historical formula measured the top edge with a
 * haversine on a sphere of radius a = 6378137 m. The true east-west
 * distance on the ellipsoid is N·cosφ·Δλ with N = a/√(1−e²·sin²φ), so the
 * spherical value is biased by a/N ≈ −0.19 % at Paris.
 *
 * Lambert CC zones are conformal (isotropic local scale) with a scale
 * factor k within 1 ± 1e-4 inside their 1°-wide latitude band (k0 ≈
 * 0.99991 on the central parallel). We request the WMS image in the zone
 * matching the viewport centre and divide the grid resolution
 * (bboxWidth / imageWidth) by k at the centre — the residual variation of
 * k across a single capture is < 1e-6, so meterByPx is exact and isotropic.
 *
 * Side effect: the image is oriented to CC grid north. Meridian
 * convergence is (λ − 3°)·sinφ, i.e. up to ≈ 5.6° at Brest / Strasbourg,
 * so the captured envelope can be a few percent larger than the Leaflet
 * viewport and its content appears rotated by that angle vs the preview.
 * This does not affect the scale.
 */
import proj4 from "proj4";

export const WGS84 = "EPSG:4326";

// GRS80 ellipsoid (RGF93)
const A = 6378137;
const E2 = 0.0066943800229;

export const CC_ZONE_MIN = 42;
export const CC_ZONE_MAX = 50;

function registerCcZones() {
  for (let zone = CC_ZONE_MIN; zone <= CC_ZONE_MAX; zone += 1) {
    const epsg = `EPSG:${3900 + zone}`;
    if (proj4.defs(epsg)) continue;
    const lat0 = zone;
    const y0 = (zone - 41) * 1000000 + 200000;
    proj4.defs(
      epsg,
      `+proj=lcc +lat_1=${lat0 - 0.75} +lat_2=${lat0 + 0.75} +lat_0=${lat0} ` +
        `+lon_0=3 +x_0=1700000 +y_0=${y0} +ellps=GRS80 ` +
        `+towgs84=0,0,0,0,0,0,0 +units=m +no_defs`
    );
  }
}
registerCcZones();

/** EPSG code of the CC zone whose band contains `lat` (clamped to 42..50). */
export function getCcZoneEpsg(lat) {
  const zone = Math.min(CC_ZONE_MAX, Math.max(CC_ZONE_MIN, Math.round(lat)));
  return `EPSG:${3900 + zone}`;
}

/** { lat, lng } → { x, y } (metres, CC grid). */
export function projectToCc(epsg, { lat, lng }) {
  const [x, y] = proj4(WGS84, epsg, [lng, lat]);
  return { x, y };
}

/** { x, y } (metres, CC grid) → { lat, lng }. */
export function unprojectFromCc(epsg, { x, y }) {
  const [lng, lat] = proj4(epsg, WGS84, [x, y]);
  return { lat, lng };
}

/** Prime vertical radius of curvature N(φ) on GRS80. */
export function primeVerticalRadius(latDeg) {
  const s = Math.sin((latDeg * Math.PI) / 180);
  return A / Math.sqrt(1 - E2 * s * s);
}

/**
 * Point scale factor k = (grid length) / (ground length) at { lat, lng },
 * computed numerically along a parallel (conformal → same in all
 * directions). Ground length of a small east-west step δλ (radians) on the
 * ellipsoid is N(φ)·cosφ·δλ.
 */
export function getCcScaleFactor(epsg, { lat, lng }) {
  const dDeg = 1e-4; // ≈ 7 m at 48° — well inside float precision, far from rounding noise
  const p0 = projectToCc(epsg, { lat, lng: lng - dDeg / 2 });
  const p1 = projectToCc(epsg, { lat, lng: lng + dDeg / 2 });
  const gridLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const dLambda = (dDeg * Math.PI) / 180;
  const groundLen =
    primeVerticalRadius(lat) * Math.cos((lat * Math.PI) / 180) * dLambda;
  return gridLen / groundLen;
}

/**
 * Build the WMS request geometry for a Leaflet-like bounds object in the
 * CC zone of its centre.
 *
 * - bbox = axis-aligned envelope of the 4 projected corners (the whole
 *   viewport is guaranteed inside; see header note on convergence).
 * - height is rounded to an integer and the bbox top is re-derived so the
 *   bbox aspect equals the pixel aspect EXACTLY (a WMS server stretches the
 *   image to WIDTH×HEIGHT, any mismatch would distort one axis).
 * - meterByPx = (bboxWidth / width) / k(centre).
 *
 * Returns { epsg, bbox: {minx,miny,maxx,maxy}, width, height, k, meterByPx,
 *           topLeftLatLng }.
 */
export function getCcCaptureGeometry({ corners, center, width }) {
  const epsg = getCcZoneEpsg(center.lat);
  const pts = corners.map((c) => projectToCc(epsg, c));
  const minx = Math.min(...pts.map((p) => p.x));
  const maxx = Math.max(...pts.map((p) => p.x));
  const miny = Math.min(...pts.map((p) => p.y));
  const rawMaxy = Math.max(...pts.map((p) => p.y));

  const bboxW = maxx - minx;
  const height = Math.max(1, Math.round((width * (rawMaxy - miny)) / bboxW));
  const maxy = miny + (bboxW * height) / width; // exact aspect match

  const k = getCcScaleFactor(epsg, center);
  const meterByPx = bboxW / width / k;

  return {
    epsg,
    bbox: { minx, miny, maxx, maxy },
    width,
    height,
    k,
    meterByPx,
    topLeftLatLng: unprojectFromCc(epsg, { x: minx, y: maxy }),
  };
}
