import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";
import polygonsIoU from "Features/geometry/utils/polygonsIoU";
import getAnnotationBBox from "Features/annotations/utils/getAnnotationBbox";
import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";

// "Offset par défaut" auto-stacking: given a freshly drawn annotation, return the
// vertical offsetZ that makes it sit JUST ABOVE every existing extruded annotation
// its footprint overlaps, or null when it overlaps nothing (caller falls through to
// the existing offset behaviour).
//
// Pure module (no React / Dexie). All geometry is in PIXEL space — candidates come
// from useAnnotationsV2 (already pixel-resolved) and the drawn shape is built from
// the pixel-space rawPoints.

// Only extruded footprints have a meaningful top to stack on. POINT/MARKER/etc. are
// never something you draw "over"; RECTANGLE/IMAGE are excluded here because their
// stored bbox units are not resolved in this list (follow-up if needed).
const TOP_TYPES = new Set(["POLYGON", "POLYLINE", "STRIP"]);

// Drawn shapes with a single-point footprint → point-in-polygon overlap test.
const POINT_DRAWN = new Set([
  "MARKER",
  "POINT",
  "LABEL",
  "TEXT",
  "IMAGE",
  "REVOLUTION_POINT",
]);

const TOL = 2; // bbox-prefilter tolerance in px (same as the avoid/merge blocks)

const toIoUShape = (poly) => ({
  outer: poly.points,
  holes: (poly.cuts ?? []).map((c) => c.points).filter((h) => h?.length >= 3),
});

// A point is "over" a candidate polygon iff it is inside the outer contour AND not
// inside any of its cuts (holes).
const pointInsidePolygon = (pt, poly) => {
  const outer = poly?.points;
  if (!pt || !outer || outer.length < 3 || !pointInPolygon(pt, outer)) return false;
  for (const cut of poly.cuts ?? []) {
    if (cut?.points?.length >= 3 && pointInPolygon(pt, cut.points)) return false;
  }
  return true;
};

// Maximum top face of a candidate in 3D:
//   offsetZ + height + max_i(offsetBottom_i + offsetTop_i, clamped >= 0)
// matches triangulateAnnotationGeometry (top_z = verticalLift + height +
// offsetBottom + offsetTop), so the new shape clears the highest ramped corner.
const candidateTop = (a) => {
  const base = (Number(a.offsetZ) || 0) + (Number(a.height) || 0);
  let residual = 0;
  for (const p of a.points ?? []) {
    const r = (Number(p.offsetBottom) || 0) + (Number(p.offsetTop) || 0);
    if (r > residual) residual = r;
  }
  return base + residual;
};

const bboxOverlaps = (a, b) =>
  a &&
  b &&
  a.x + a.width >= b.x - TOL &&
  a.x <= b.x + b.width + TOL &&
  a.y + a.height >= b.y - TOL &&
  a.y <= b.y + b.height + TOL;

/**
 * @param {Object}  params
 * @param {Object}  params.drawn        pixel-space drawn shape
 *   { id?, type, points:[{x,y,type?}], cuts?, strokeWidth?, strokeWidthUnit?, closeLine?, point? }
 * @param {Array}   params.candidates   pixel-resolved visible annotations
 * @param {number} [params.meterByPx]   for band polygonization of POLYLINE/STRIP
 * @returns {number|null}               stack top, or null when nothing overlapped
 */
export default function getDefaultStackOffsetZ({ drawn, candidates, meterByPx }) {
  if (!drawn || !Array.isArray(candidates) || candidates.length === 0) return null;

  const isPointDrawn = POINT_DRAWN.has(drawn.type);
  const drawnPoint = isPointDrawn ? drawn.point ?? drawn.points?.[0] : null;

  // Drawn footprint as polygons (area / band types); [] for point + un-polygonizable.
  const drawnPolys = isPointDrawn ? [] : getAnnotationAsPolygons(drawn, { meterByPx });
  const drawnVerts = drawn.points ?? [];
  const drawnBbox = isPointDrawn
    ? drawnPoint
      ? { x: drawnPoint.x, y: drawnPoint.y, width: 0, height: 0 }
      : null
    : getAnnotationBBox(drawn);
  if (!drawnBbox) return null;

  const drawnIoU = drawnPolys.map(toIoUShape);

  let maxTop = null;
  let overlappedAny = false;

  for (const a of candidates) {
    if (!a?.id || !TOP_TYPES.has(a.type)) continue;
    if ((Number(a.height) || 0) <= 0) continue;
    if (drawn.id && a.id === drawn.id) continue;

    const candBbox = getAnnotationBBox(a);
    if (!bboxOverlaps(drawnBbox, candBbox)) continue;

    const candPolys = getAnnotationAsPolygons(a, { meterByPx });
    if (candPolys.length === 0) continue;

    let overlaps = false;
    if (isPointDrawn && drawnPoint) {
      overlaps = candPolys.some((cp) => pointInsidePolygon(drawnPoint, cp));
    } else if (drawnIoU.length > 0) {
      overlaps = candPolys.some((cp) => {
        const cShape = toIoUShape(cp);
        return drawnIoU.some((dShape) => polygonsIoU(dShape, cShape) > 0);
      });
    } else {
      // Un-polygonizable drawn path (zero-width COTE / axis): sample its vertices.
      overlaps = candPolys.some((cp) =>
        drawnVerts.some((v) => pointInsidePolygon(v, cp))
      );
    }
    if (!overlaps) continue;

    overlappedAny = true;
    const top = candidateTop(a);
    if (maxTop === null || top > maxTop) maxTop = top;
  }

  return overlappedAny ? maxTop : null;
}
