import polygonClipping from "polygon-clipping";

import { expandArcsInPath } from "../../geometry/utils/arcSampling.js";
import { multiPolygonArea } from "../../geometry/utils/polygonsIntersectionArea.js";

// Ring helpers shared by the overlapping-cuts detection (findOverlappingCuts)
// and its repair (mergeCutRings). Pixel space, relative imports with explicit
// extensions so both run under `node --test`.

// chords per arc half when a cut carries S-C-S arcs (polygon-clipping is
// straight-line only) — same value as mergeTwoPolygons.
export const CUT_ARC_SAMPLES = 12;

export const round3 = (v) => parseFloat(v.toFixed(3));
export const keyOf = (x, y) => `${x.toFixed(3)}_${y.toFixed(3)}`;

// Points of a cut without the closing point some write paths repeat
// (last === first), and without the ones lacking coordinates.
export function getCutOpenPoints(cut) {
  const pts = (cut?.points ?? []).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (keyOf(first.x, first.y) === keyOf(last.x, last.y)) pts.pop();
  }
  return pts;
}

// Closed GeoJSON ring ([x, y] pairs, last = first) of open typed points,
// arcs expanded.
export function pointsToClosedRing(points) {
  const expanded = expandArcsInPath(points, CUT_ARC_SAMPLES, true);
  const ring = expanded.map((p) => [round3(p.x), round3(p.y)]);
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

// polygon-clipping multipolygon of one cut, normalized (a self-crossing ring
// becomes clean polygons) — null when degenerate.
export function cutToMultiPolygon(cut) {
  const points = getCutOpenPoints(cut);
  if (points.length < 3) return null;
  try {
    const multiPolygon = polygonClipping.union([pointsToClosedRing(points)]);
    return multiPolygonArea(multiPolygon) > 0 ? multiPolygon : null;
  } catch {
    return null;
  }
}

export function getBBox(multiPolygon) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of multiPolygon) {
    for (const [x, y] of polygon[0]) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}
