import polygonClipping from "polygon-clipping";

import {
  typeOf,
  circleFromThreePoints,
  expandArcsInPath,
  arcUnitsToTypedPoints,
} from "./arcSampling";
import collapseArcsInPolyline from "./collapseArcsInPolyline";
import wallToRectRing, { wallToHollowRings } from "./wallToRectRing";

// Same offset-band pipeline as useWallBoundaries (Contour button), reduced to
// the union step: no edge classification, the output is grouped per merged
// polygon so callers can pick the loop(s) they care about.

function ringToPoints(pairs) {
  const pts = pairs.map(([x, y]) => ({ x, y }));
  // polygon-clipping rings repeat the first vertex at the end
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 1 && first.x === last.x && first.y === last.y) pts.pop();
  return pts;
}

function toClosedPairs(ring) {
  const pairs = ring.map((p) => [p.x, p.y]);
  pairs.push([ring[0].x, ring[0].y]);
  return pairs;
}

function ringArea(pts) {
  let sum = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum / 2);
}

/**
 * Union the offset bands of wall centerlines and return, per merged polygon,
 * its exterior ring and its hole rings. When walls form a closed loop, the
 * union is an annulus whose hole IS the inner contour of the loop — so
 * "no hole" also means "no closed loop".
 *
 * @param {Array<{points: Array<{x,y,type?}>, halfWidthPx: number, closed?: boolean}>} walls
 *   Wall centerlines in pixel space; S-C-S arc control points supported.
 * @param {{arcSamples?: number}} [opts]
 * @returns {Array<{exterior: Array<{x,y}>, holes: Array<Array<{x,y,type?}>>}>}
 *   Rings without duplicate closing vertex; hole arcs re-fitted as S-C-S
 *   typed points.
 */
export default function computeWallBandInnerRings(
  walls,
  { arcSamples = 16 } = {}
) {
  // Circles of every S-C-S arc present in the source walls: provenance hints
  // for collapseArcsInPolyline so tessellated arcs are recovered on output.
  const sourceArcCircles = [];
  let maxThicknessPx = 0;

  const bands = [];
  for (const wall of walls) {
    const pts = wall?.points ?? [];
    const halfWidth = wall?.halfWidthPx ?? 0;
    if (pts.length < 2 || !(halfWidth > 0)) continue;

    // A closed wall's closing primitive can be an arc whose "circle" midpoint
    // is the LAST control point (the S-C-S triple wraps to points[0]); walk
    // with wrap so that closing arc is captured as a source circle (and
    // tessellated below via the same closeLine flag).
    const nPts = pts.length;
    const tripleCount = wall.closed ? nPts : nPts - 2;
    for (let k = 0; k < tripleCount; k++) {
      const p0 = pts[k];
      const p1 = pts[(k + 1) % nPts];
      const p2 = pts[(k + 2) % nPts];
      if (
        typeOf(p0) !== "circle" &&
        typeOf(p1) === "circle" &&
        typeOf(p2) !== "circle"
      ) {
        const c = circleFromThreePoints(p0, p1, p2);
        if (c) sourceArcCircles.push(c);
      }
    }

    // Expand arcs into straight samples, then drop degenerate segments so the
    // offset step only sees clean straight edges. A closed wall must expand
    // with wrap so a closing arc bulges instead of collapsing onto its chord.
    const expanded = expandArcsInPath(pts, arcSamples, wall.closed === true);
    const filtered = [expanded[0]];
    for (let i = 1; i < expanded.length; i++) {
      const prev = filtered[filtered.length - 1];
      if (
        Math.abs(expanded[i].x - prev.x) > 0.1 ||
        Math.abs(expanded[i].y - prev.y) > 0.1
      ) {
        filtered.push(expanded[i]);
      }
    }
    if (filtered.length < 2) continue;

    if (halfWidth * 2 > maxThicknessPx) maxThicknessPx = halfWidth * 2;

    if (wall.closed && filtered.length >= 3) {
      // A closed centerline is already a loop: feed its annulus as a
      // polygon-with-hole so the closing segment and the hole survive union.
      const rings = wallToHollowRings(filtered, halfWidth);
      if (!rings) continue;
      bands.push([[toClosedPairs(rings.outer), toClosedPairs(rings.inner)]]);
    } else {
      const ring = wallToRectRing(filtered, halfWidth);
      if (ring) bands.push([[ring]]);
    }
  }

  if (bands.length === 0) return [];

  let merged;
  try {
    merged = polygonClipping.union(...bands);
  } catch (e) {
    console.error(
      "[computeWallBandInnerRings] polygon-clipping union failed:",
      e
    );
    return [];
  }

  // Sliver holes can appear at imperfect wall junctions; a real room is far
  // larger than one wall-thickness square.
  const minHoleArea = maxThicknessPx * maxThicknessPx;

  const result = [];
  for (const polygon of merged ?? []) {
    if (!polygon?.length) continue;
    const exterior = ringToPoints(polygon[0]);
    const holes = [];
    for (let r = 1; r < polygon.length; r++) {
      const raw = ringToPoints(polygon[r]);
      if (raw.length < 3 || ringArea(raw) < minHoleArea) continue;
      const units = collapseArcsInPolyline(raw, {
        thicknessPx: maxThicknessPx,
        sourceArcCircles,
        // An inner-contour arc is concentric with the wall arc it offsets;
        // require that match so corners between merged walls are not
        // mis-fitted as arcs.
        requireSourceMatch: true,
      });
      holes.push(units.length > 0 ? arcUnitsToTypedPoints(units) : raw);
    }
    result.push({ exterior, holes });
  }
  return result;
}
