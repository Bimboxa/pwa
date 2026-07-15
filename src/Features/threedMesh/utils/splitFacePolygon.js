import polygonClipping from "polygon-clipping";

import { polygonArea2d } from "./computeFaceArea.js";

// Straight-cut split of a 2D polygon-with-holes (face loops projected in
// their plane basis). Unlike geometry/utils/splitPolygonByPolyline (which is
// annotation-oriented: point-id reconciliation, 0-1 coords, exterior ring
// only), this works in meters, keeps the full MultiPolygon structure (holes
// survive the cut) and can return more than two pieces (cutting a concave
// polygon along the infinite line can disconnect one side).

const closeRing = (loop) => {
  const ring = loop.map((p) => [p.x, p.y]);
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  return ring;
};

const openLoop = (ring) =>
  ring.slice(0, ring.length - 1).map(([x, y]) => ({ x, y }));

function toPieces(multiPolygon) {
  const pieces = [];
  for (const polygon of multiPolygon) {
    if (!polygon.length) continue;
    const contour = openLoop(polygon[0]);
    if (contour.length < 3) continue;
    const holes = polygon
      .slice(1)
      .map(openLoop)
      .filter((hole) => hole.length >= 3);
    pieces.push({ contour, holes, area: polygonArea2d(contour, holes) });
  }
  return pieces;
}

// Nearest point on the contour boundary to p: edge index, parameter t along
// that edge and the projected point.
function locateOnContour(contour, p) {
  const n = contour.length;
  let best = null;
  for (let i = 0; i < n; i++) {
    const p1 = contour[i];
    const p2 = contour[(i + 1) % n];
    const ex = p2.x - p1.x;
    const ey = p2.y - p1.y;
    const lenSq = ex * ex + ey * ey;
    if (lenSq === 0) continue;
    let t = ((p.x - p1.x) * ex + (p.y - p1.y) * ey) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const x = p1.x + t * ex;
    const y = p1.y + t * ey;
    const dist = Math.hypot(p.x - x, p.y - y);
    if (!best || dist < best.dist)
      best = { edgeIndex: i, point: { x, y }, dist };
  }
  return best;
}

const dedupeRing = (ring, eps) =>
  ring.filter((p, i) => {
    const prev = ring[(i - 1 + ring.length) % ring.length];
    return Math.hypot(p.x - prev.x, p.y - prev.y) > eps;
  });

// The two rings obtained by walking the contour between the chord endpoints
// (a, b), both expected on the boundary: [a ..vertices.. b] closed by the
// chord, and its complement. Null when the chord is degenerate (a ~ b, or
// both endpoints on the same edge so the chord lies along the boundary).
function chordRings(contour, a, b, eps) {
  const la = locateOnContour(contour, a);
  const lb = locateOnContour(contour, b);
  if (!la || !lb) return null;
  if (Math.hypot(la.point.x - lb.point.x, la.point.y - lb.point.y) <= eps) {
    return null;
  }
  if (la.edgeIndex === lb.edgeIndex) return null;

  const n = contour.length;
  const walk = (from, to) => {
    const ring = [from.point];
    for (let i = (from.edgeIndex + 1) % n; ; i = (i + 1) % n) {
      ring.push(contour[i]);
      if (i === to.edgeIndex) break;
    }
    ring.push(to.point);
    return dedupeRing(ring, eps);
  };

  const ring1 = walk(la, lb);
  const ring2 = walk(lb, la);
  if (ring1.length < 3 || ring2.length < 3) return null;
  return [ring1, ring2];
}

/**
 * Split a 2D polygon-with-holes by the straight line through (a, b).
 *
 * @param {object} args
 * @param {Array<{x,y}>} args.contour - outer loop (open)
 * @param {Array<Array<{x,y}>>} [args.holes]
 * @param {{x,y}} args.a - cut segment start (plane 2D coords, meters)
 * @param {{x,y}} args.b - cut segment end
 * @param {boolean} [args.clampToSegment] - free cut: (a, b) are on the contour
 *   and only the [a, b] chord cuts — the boundary is walked between the two
 *   endpoints, yielding exactly the two sides of the chord; default cuts
 *   along the full infinite line.
 * @returns {Array<{contour, holes, area}> | null} pieces sorted by area desc,
 *   or null when the line does not actually divide the polygon.
 */
export default function splitFacePolygon({
  contour,
  holes = [],
  a,
  b,
  clampToSegment = false,
}) {
  if (!contour || contour.length < 3) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;

  // Scale-aware extents (the polygon is in meters, of any magnitude).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of contour) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY);
  const subject = [[closeRing(contour), ...holes.map(closeRing)]];

  let side1;
  let side2;
  if (clampToSegment) {
    // Chord split: walk the contour between the two on-boundary endpoints so
    // the only new edge is the [a, b] chord itself (no perpendicular
    // end-caps slicing whatever extends beyond the segment). Intersecting
    // each ring with the subject subtracts the holes and clips the parts of
    // the ring a concave contour may push outside the polygon.
    const rings = chordRings(contour, a, b, diag * 1e-9);
    if (!rings) return null;
    try {
      side1 = polygonClipping.intersection([[closeRing(rings[0])]], subject);
      side2 = polygonClipping.intersection([[closeRing(rings[1])]], subject);
    } catch (error) {
      console.error("[splitFacePolygon] polygon-clipping error:", error);
      return null;
    }
  } else {
    // Half-plane band on one side of the cut line, extended far beyond the
    // polygon so it acts as the infinite line through (a, b).
    const extend = diag * 2;
    const offset = diag * 2;
    const a2 = { x: a.x - ux * extend, y: a.y - uy * extend };
    const b2 = { x: b.x + ux * extend, y: b.y + uy * extend };
    const nx = -uy;
    const ny = ux;
    const band = [
      a2,
      b2,
      { x: b2.x + nx * offset, y: b2.y + ny * offset },
      { x: a2.x + nx * offset, y: a2.y + ny * offset },
    ];
    const bandGeom = [[closeRing(band)]];
    try {
      side1 = polygonClipping.intersection(subject, bandGeom);
      side2 = polygonClipping.difference(subject, bandGeom);
    } catch (error) {
      console.error("[splitFacePolygon] polygon-clipping error:", error);
      return null;
    }
  }

  const pieces = [...toPieces(side1), ...toPieces(side2)];
  if (pieces.length < 2) return null;

  // Ignore slivers born from numerical noise along the cut.
  const minArea = diag * diag * 1e-9;
  const solid = pieces.filter((piece) => piece.area > minArea);
  if (solid.length < 2) return null;

  return solid.sort((p1, p2) => p2.area - p1.area);
}
