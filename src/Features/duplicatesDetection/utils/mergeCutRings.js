import polygonClipping from "polygon-clipping";

import { extractArcCircles } from "../../geometry/utils/arcSampling.js";

import {
  getCutOpenPoints,
  keyOf,
  pointsToClosedRing,
  round3,
} from "./cutRings.js";

// PURE union of overlapping cuts (one cluster of findOverlappingCuts) into a
// single ring. Input cuts carry resolved pixel points `{ id, x, y, type }`.
//
// Returns `{ points }`, the merged ring as open typed points: a vertex that
// sits on a source point reuses it (`{ id, x, y, type }`), any other one
// (crossing of two cuts, recovered arc control point) is `{ x, y, type }`
// without id — the caller mints it. Returns null when the union is not ONE
// ring without a hole (disjoint cuts, or cuts enclosing an island): such a
// cluster cannot be stored as a single cut.
//
// `collapseArcs` (collapseArcsInPolyline, injected: it is not importable
// under node) recovers the S-C-S arcs of the source cuts; without it, or
// without any source arc, the ring is all straight segments.
export default function mergeCutRings(cuts, { collapseArcs } = {}) {
  const pointByXY = new Map();
  const rings = [];
  const sourceArcCircles = [];

  for (const cut of cuts ?? []) {
    const points = getCutOpenPoints(cut);
    if (points.length < 3) continue;
    for (const p of points) {
      const key = keyOf(round3(p.x), round3(p.y));
      if (!pointByXY.has(key)) pointByXY.set(key, p);
    }
    sourceArcCircles.push(...extractArcCircles(points));
    rings.push(pointsToClosedRing(points));
  }
  if (rings.length < 2) return null;

  let union;
  try {
    const [first, ...others] = rings.map((ring) => [ring]);
    union = polygonClipping.union(first, ...others);
  } catch {
    return null;
  }
  if (union.length !== 1 || union[0].length !== 1) return null;

  const ringPx = union[0][0].slice(0, -1).map(([x, y]) => ({ x, y }));
  if (ringPx.length < 3) return null;

  let typed;
  if (sourceArcCircles.length > 0 && collapseArcs) {
    // closed loop scanned as a polyline: an arc straddling the (arbitrary)
    // ring seam stays faceted, like mergeTwoPolygons.
    const units = collapseArcs(ringPx, {
      sourceArcCircles,
      requireSourceMatch: true,
    });
    typed = [];
    units.forEach((unit, unitIndex) => {
      (unit.points ?? []).forEach((p, pointIndex) => {
        if (unitIndex > 0 && pointIndex === 0) return;
        typed.push({ x: p.x, y: p.y, type: p.type });
      });
    });
    // the polyline scan repeats the seam vertex at both ends
    if (typed.length > 1) {
      const first = typed[0];
      const last = typed[typed.length - 1];
      if (keyOf(first.x, first.y) === keyOf(last.x, last.y)) typed.pop();
    }
  } else {
    typed = ringPx;
  }

  const points = typed.map((p) => {
    const type = p.type === "circle" ? "circle" : "square";
    const source = pointByXY.get(keyOf(p.x, p.y));
    if (source?.id) return { id: source.id, x: source.x, y: source.y, type };
    return { x: round3(p.x), y: round3(p.y), type };
  });

  return { points };
}
