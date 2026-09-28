// Print zone of a base map (« Zone d'impression ») — pure maths, no db /
// redux imports.
//
// baseMap.printZone = {
//   format: "A0" | "A1" | "A2" | "A3" | "A4",
//   orientation: "landscape" | "portrait",
//   scale: number | null,      // plan scale 1:N, null = free ("libre")
//   x, y, width, height,       // rect in REFERENCE image px (baseMap.getImageSize())
// }
//
// The zone is the WHOLE physical sheet. Its rect may overflow the image
// (the sheet can be larger than the plan) and always keeps the page aspect
// ratio (every writer enforces it; readers only rely on `width`).
//
// Unit maths: 1 pt = 1/72 in, mm = pt * 25.4 / 72. At scale 1:N,
//   zoneWidthPx = pageWidthMm * N / (1000 * meterByPx)
//   pagePxPerPt = zoneWidthPx / pageWidthPt   (page-pt → image-px, texts)

import getPageDimensions, {
  PAGE_FORMAT_KEYS,
} from "Features/portfolioEditor/utils/getPageDimensions";

export const PRINT_ZONE_FORMATS = PAGE_FORMAT_KEYS;
export const PRINT_ZONE_ORIENTATIONS = ["landscape", "portrait"];
export const PRINT_ZONE_DEFAULT_FORMAT = "A3";
export const PRINT_ZONE_DEFAULT_ORIENTATION = "landscape";
export const MM_PER_PT = 25.4 / 72;

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

export function isPrintZoneValid(zone) {
  return Boolean(
    zone &&
    PRINT_ZONE_FORMATS.includes(zone.format) &&
    PRINT_ZONE_ORIENTATIONS.includes(zone.orientation) &&
    isFiniteNumber(zone.x) &&
    isFiniteNumber(zone.y) &&
    isFiniteNumber(zone.width) &&
    zone.width > 0 &&
    isFiniteNumber(zone.height) &&
    zone.height > 0
  );
}

export function getPrintZonePageDimensionsPt(format, orientation) {
  return getPageDimensions(format, orientation);
}

export function getPrintZonePageDimensionsMm(format, orientation) {
  const pt = getPageDimensions(format, orientation);
  return { width: pt.width * MM_PER_PT, height: pt.height * MM_PER_PT };
}

export function getPrintZoneAspect(format, orientation) {
  const pt = getPageDimensions(format, orientation);
  return pt.width / pt.height;
}

// Page-pt → image-px scale of the texts drawn on this base map. null when
// the zone is missing / invalid (callers fall back to the legacy formula).
export function getPrintZonePxPerPt(zone) {
  if (!isPrintZoneValid(zone)) return null;
  const pt = getPageDimensions(zone.format, zone.orientation);
  return zone.width / pt.width;
}

// Size in image px of a sheet printed at 1:scale on a base map whose
// resolution is meterByPx. null when scale / meterByPx are unusable.
export function getPrintZoneSizePxFromScale({
  format,
  orientation,
  scale,
  meterByPx,
}) {
  if (!(scale > 0) || !(meterByPx > 0)) return null;
  const mm = getPrintZonePageDimensionsMm(format, orientation);
  const width = (mm.width * scale) / (1000 * meterByPx);
  return { width, height: width / getPrintZoneAspect(format, orientation) };
}

// Inverse calibration: the meterByPx that makes the zone a 1:scale sheet.
export function getMeterByPxFromPrintZone(zone) {
  if (!isPrintZoneValid(zone) || !(zone.scale > 0)) return null;
  const mm = getPrintZonePageDimensionsMm(zone.format, zone.orientation);
  return (mm.width * zone.scale) / (1000 * zone.width);
}

// Derived 1:N of the zone given the base map resolution (display only).
export function getScaleFromPrintZone(zone, meterByPx) {
  if (!isPrintZoneValid(zone) || !(meterByPx > 0)) return null;
  const mm = getPrintZonePageDimensionsMm(zone.format, zone.orientation);
  return (1000 * meterByPx * zone.width) / mm.width;
}

// Smallest page-aspect rect enclosing the whole image, centred on it.
export function fitPrintZoneToImage({ format, orientation, imageSize }) {
  const W = imageSize?.width;
  const H = imageSize?.height;
  if (!(W > 0) || !(H > 0)) return null;
  const aspect = getPrintZoneAspect(format, orientation);
  let width;
  let height;
  if (W / H > aspect) {
    width = W;
    height = W / aspect;
  } else {
    height = H;
    width = H * aspect;
  }
  return { x: (W - width) / 2, y: (H - height) / 2, width, height };
}

export function centerPrintZoneOnImage(zone, imageSize) {
  const W = imageSize?.width;
  const H = imageSize?.height;
  if (!(W > 0) || !(H > 0)) return zone;
  return {
    ...zone,
    x: (W - zone.width) / 2,
    y: (H - zone.height) / 2,
  };
}

export function resizePrintZoneKeepingCenter(zone, { width, height }) {
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;
  return { ...zone, x: cx - width / 2, y: cy - height / 2, width, height };
}

export function createDefaultPrintZone({
  imageSize,
  format = PRINT_ZONE_DEFAULT_FORMAT,
  orientation = PRINT_ZONE_DEFAULT_ORIENTATION,
}) {
  const rect = fitPrintZoneToImage({ format, orientation, imageSize });
  if (!rect) return null;
  return { format, orientation, scale: null, ...rect };
}

// Format / orientation / scale change. Locked (scale + meterByPx known):
// the size snaps to the exact 1:scale sheet. Free: the implicit px/mm of the
// sheet is kept (an A3 → A4 swap shrinks the zone like a real sheet would).
// The zone centre never moves.
export function applyPrintZoneFormatChange(
  zone,
  { format = zone.format, orientation = zone.orientation, scale, meterByPx }
) {
  const nextScale = scale === undefined ? zone.scale : scale;
  const next = { ...zone, format, orientation, scale: nextScale };
  let size = getPrintZoneSizePxFromScale({
    format,
    orientation,
    scale: nextScale,
    meterByPx,
  });
  if (!size) {
    const oldMm = getPrintZonePageDimensionsMm(zone.format, zone.orientation);
    const newMm = getPrintZonePageDimensionsMm(format, orientation);
    const width = (zone.width * newMm.width) / oldMm.width;
    size = { width, height: width / getPrintZoneAspect(format, orientation) };
  }
  return resizePrintZoneKeepingCenter(next, size);
}

// Zone covering the whole image as a known sheet (blank pages created at a
// given format / scale, PDF pages rendered full-page).
export function createPrintZoneFromSheet({
  format,
  orientation,
  scale = null,
  imageSize,
}) {
  const W = imageSize?.width;
  const H = imageSize?.height;
  if (!(W > 0) || !(H > 0)) return null;
  if (!PRINT_ZONE_FORMATS.includes(format)) return null;
  if (!PRINT_ZONE_ORIENTATIONS.includes(orientation)) return null;
  return {
    format,
    orientation,
    scale: scale > 0 ? scale : null,
    x: 0,
    y: 0,
    width: W,
    height: W / getPrintZoneAspect(format, orientation),
  };
}

// Closest ISO A format / orientation of a sheet given in pt (3% tolerance),
// null when the sheet is not an A format.
const FORMAT_MATCH_TOLERANCE = 0.03;
export function matchPageFormat(widthPt, heightPt) {
  if (!(widthPt > 0) || !(heightPt > 0)) return null;
  let best = null;
  for (const format of PRINT_ZONE_FORMATS) {
    for (const orientation of PRINT_ZONE_ORIENTATIONS) {
      const pt = getPageDimensions(format, orientation);
      const err = Math.max(
        Math.abs(widthPt - pt.width) / pt.width,
        Math.abs(heightPt - pt.height) / pt.height
      );
      if (err <= FORMAT_MATCH_TOLERANCE && (!best || err < best.err)) {
        best = { format, orientation, err };
      }
    }
  }
  return best ? { format: best.format, orientation: best.orientation } : null;
}

// Sheet of a base map rendered from a PDF page (createdFrom = PDF_PAGE with
// dpi, optional crop bboxInRatio {x1,y1,x2,y2} in page ratio): the full page
// rect in image px, when the page is an A format. Cropped renders get the
// page placed around the crop (negative offsets).
export function getPdfPagePrintZone({ createdFrom, imageSize }) {
  const W = imageSize?.width;
  const H = imageSize?.height;
  const dpi = Number(createdFrom?.dpi);
  if (createdFrom?.type !== "PDF_PAGE" || !(dpi > 0)) return null;
  if (!(W > 0) || !(H > 0)) return null;
  const bbox = createdFrom.bboxInRatio;
  const spanX = bbox ? bbox.x2 - bbox.x1 : 1;
  const spanY = bbox ? bbox.y2 - bbox.y1 : 1;
  if (!(spanX > 0) || !(spanY > 0)) return null;
  const pagePxW = W / spanX;
  const pagePxH = H / spanY;
  const match = matchPageFormat((pagePxW * 72) / dpi, (pagePxH * 72) / dpi);
  if (!match) return null;
  const scale = Number(createdFrom.blueprintScale);
  return {
    format: match.format,
    orientation: match.orientation,
    scale: scale > 0 ? scale : null,
    x: bbox ? -bbox.x1 * pagePxW : 0,
    y: bbox ? -bbox.y1 * pagePxH : 0,
    width: pagePxW,
    height: pagePxW / getPrintZoneAspect(match.format, match.orientation),
  };
}

// Every base map has a print zone: the stored one, else the PDF page it was
// rendered from, else an A3 landscape sheet fitted to the image. Pure —
// takes the record fields (BaseMap.getPrintZone / raw db rows).
export function resolvePrintZone({ printZone, createdFrom, imageSize }) {
  if (isPrintZoneValid(printZone)) return printZone;
  const fromPdf = getPdfPagePrintZone({ createdFrom, imageSize });
  if (fromPdf) return fromPdf;
  return createDefaultPrintZone({ imageSize });
}

// "50", "100", "1234.5" — same display rule as FieldBaseMapBlueprintScale.
export function formatPrintZoneScale(scale) {
  if (!(scale > 0)) return "";
  return scale.toFixed(1).replace(/\.0$/, "");
}

// Storage rounding: the zone is a print frame, integer px are plenty.
export function roundPrintZone(zone) {
  if (!zone) return zone;
  return {
    ...zone,
    x: Math.round(zone.x),
    y: Math.round(zone.y),
    width: Math.round(zone.width),
    height: Math.round(zone.height),
  };
}
