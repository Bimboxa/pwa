import L from "leaflet";

const IGN_WMS_URL = "https://data.geopf.fr/wms-r/wms";

// Cascade from highest to lowest resolution. THR (5-10cm) only covers some
// areas — when it returns a blank image we fall back to the standard layer
// (20cm) which covers all of metropolitan France + DOM-TOM.
const DEFAULT_LAYER_CASCADE = [
  "THR.ORTHOIMAGERY.ORTHOPHOTOS",
  "ORTHOIMAGERY.ORTHOPHOTOS",
];

// Tiny low-res probe to detect coverage cheaply before downloading the full
// high-res image. A blank/transparent image at 64x64 weighs a few hundred
// bytes; a real one is several KB.
const PROBE_SIZE = 64;
const PROBE_MIN_VARIANCE = 4;

function buildUrl({ layer, crs, bbox, width, height, format }) {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    LAYERS: layer,
    STYLES: "",
    CRS: crs,
    BBOX: bbox,
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: format,
  });
  return `${IGN_WMS_URL}?${params.toString()}`;
}

async function hasCoverage({ layer, crs, bbox, format }) {
  const url = buildUrl({
    layer,
    crs,
    bbox,
    width: PROBE_SIZE,
    height: PROBE_SIZE,
    format,
  });
  const r = await fetch(url);
  if (!r.ok || !isImageResponse(r)) return false;
  const blob = await r.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = PROBE_SIZE;
  canvas.height = PROBE_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    n += 1;
  }
  const rMean = rSum / n;
  const gMean = gSum / n;
  const bMean = bSum / n;

  let variance = 0;
  for (let i = 0; i < data.length; i += 4) {
    variance +=
      Math.abs(data[i] - rMean) +
      Math.abs(data[i + 1] - gMean) +
      Math.abs(data[i + 2] - bMean);
  }
  variance /= n;

  return variance >= PROBE_MIN_VARIANCE;
}

function isImageResponse(response) {
  const ct = response.headers.get("content-type") ?? "";
  return ct.startsWith("image/");
}

/**
 * Fetch one WMS GetMap from the IGN Géoplateforme.
 *
 * Geometry can be given either as:
 *  - `bounds` (Leaflet LatLngBounds) → legacy EPSG:3857 request, or
 *  - `crs` + `bbox` ({ minx, miny, maxx, maxy } in CRS units) for an explicit
 *    projection (LAMBERT_CC mode).
 *
 * Guards: a WMS error is an XML body served with HTTP 200 — we reject any
 * non-image content-type, and we decode the blob to assert the server
 * honoured WIDTH×HEIGHT exactly (the scale is derived from those sizes).
 *
 * Returns { file, width, height, layer, crs, bbox }.
 */
export default async function fetchIgnStaticImage({
  bounds,
  crs,
  bbox: bboxObj,
  width = 2048,
  height,
  layers = DEFAULT_LAYER_CASCADE,
  format = "image/png",
  name = "image-satellite.png",
}) {
  let finalCrs = crs;
  let box = bboxObj;
  if (!box) {
    if (!bounds) throw new Error("bounds or bbox is required");
    const sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
    const ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
    finalCrs = "EPSG:3857";
    box = { minx: sw.x, miny: sw.y, maxx: ne.x, maxy: ne.y };
  }
  if (!finalCrs) throw new Error("crs is required with bbox");

  const aspect = (box.maxx - box.minx) / (box.maxy - box.miny);
  const finalHeight = height ?? Math.max(1, Math.round(width / aspect));
  const bbox = `${box.minx},${box.miny},${box.maxx},${box.maxy}`;

  // Pick the first layer in the cascade that has coverage on this bbox.
  // The last layer is the universal fallback — no probe needed.
  let selectedLayer = layers[layers.length - 1];
  for (let i = 0; i < layers.length - 1; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await hasCoverage({
      layer: layers[i],
      crs: finalCrs,
      bbox,
      format,
    });
    if (ok) {
      selectedLayer = layers[i];
      break;
    }
  }

  const url = buildUrl({
    layer: selectedLayer,
    crs: finalCrs,
    bbox,
    width,
    height: finalHeight,
    format,
  });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `IGN WMS request failed: ${response.status} ${response.statusText}`
    );
  }

  // eslint-disable-next-line no-console
  console.log("[satellite] capture layer:", selectedLayer);

  if (!isImageResponse(response)) {
    const text = await response.text();
    throw new Error(
      `IGN WMS returned a non-image response: ${text.slice(0, 300)}`
    );
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const decoded = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  if (decoded.width !== width || decoded.height !== finalHeight) {
    throw new Error(
      `IGN WMS image size mismatch: requested ${width}x${finalHeight}, ` +
        `got ${decoded.width}x${decoded.height}`
    );
  }

  return {
    file: new File([blob], name, { type: format }),
    width: decoded.width,
    height: decoded.height,
    layer: selectedLayer,
    crs: finalCrs,
    bbox: box,
  };
}
