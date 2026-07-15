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

// Nearest point on any of the boundary loops (contour + holes) to p: loop
// index, edge index, parameter t along that edge and the projected point.
function locateOnLoops(loops, p) {
  let best = null;
  loops.forEach((loop, loopIndex) => {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const p1 = loop[i];
      const p2 = loop[(i + 1) % n];
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
        best = { loopIndex, edgeIndex: i, t, point: { x, y }, dist };
    }
  });
  return best;
}

const dedupeRing = (ring, eps) =>
  ring.filter((p, i) => {
    const prev = ring[(i - 1 + ring.length) % ring.length];
    return Math.hypot(p.x - prev.x, p.y - prev.y) > eps;
  });

// Closed ring made of the cut path plus the boundary walk joining its two
// endpoints. Both endpoints must sit on the SAME loop (outer contour or one
// hole) — a path between two different loops does not divide the face. One
// side of the cut is (ring ∩ face), the other is (face − ring).
function pathRing(contour, holes, path, eps) {
  const loops = [contour, ...holes.filter((hole) => hole?.length >= 3)];
  const la = locateOnLoops(loops, path[0]);
  const lb = locateOnLoops(loops, path[path.length - 1]);
  if (!la || !lb) return null;
  if (la.loopIndex !== lb.loopIndex) return null;
  if (Math.hypot(la.point.x - lb.point.x, la.point.y - lb.point.y) <= eps) {
    return null;
  }

  // Same-edge endpoints (path dipping into the face and coming back): orient
  // the path along the edge direction so the ring's two half-edge segments
  // do not overlap.
  let start = la;
  let end = lb;
  let inner = path.slice(1, -1);
  if (la.edgeIndex === lb.edgeIndex && lb.t < la.t) {
    start = lb;
    end = la;
    inner = inner.slice().reverse();
  }

  const loop = loops[start.loopIndex];
  const n = loop.length;
  const ring = [start.point, ...inner, end.point];
  for (let i = (end.edgeIndex + 1) % n; ; i = (i + 1) % n) {
    ring.push(loop[i]);
    if (i === start.edgeIndex) break;
  }
  const deduped = dedupeRing(ring, eps);
  return deduped.length >= 3 ? deduped : null;
}

/**
 * Split a 2D polygon-with-holes along a cut path or an infinite line.
 *
 * @param {object} args
 * @param {Array<{x,y}>} args.contour - outer loop (open)
 * @param {Array<Array<{x,y}>>} [args.holes]
 * @param {{x,y}} [args.a] - line mode: cut along the infinite line through
 *   (a, b)
 * @param {{x,y}} [args.b]
 * @param {Array<{x,y}>} [args.path] - path mode (takes precedence): the cut
 *   follows this polyline, whose endpoints must sit on the same boundary
 *   loop (outer contour or one hole); only the path itself cuts.
 * @returns {Array<{contour, holes, area}> | null} pieces sorted by area desc,
 *   or null when the cut does not actually divide the polygon.
 */
export default function splitFacePolygon({ contour, holes = [], a, b, path }) {
  if (!contour || contour.length < 3) return null;
  const cutPath = path?.length >= 2 ? path : null;
  if (!cutPath && (!a || !b)) return null;

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
  if (cutPath) {
    // Path split: walk the boundary between the two on-boundary endpoints so
    // the only new edges are the path segments themselves (no perpendicular
    // end-caps slicing whatever extends beyond the path). Intersecting the
    // ring with the subject subtracts the holes and clips the parts of the
    // ring a concave contour may push outside the polygon; the complement is
    // recovered by difference.
    const ring = pathRing(contour, holes, cutPath, diag * 1e-9);
    if (!ring) return null;
    const ringGeom = [[closeRing(ring)]];
    try {
      side1 = polygonClipping.intersection(ringGeom, subject);
      side2 = polygonClipping.difference(subject, ringGeom);
    } catch (error) {
      console.error("[splitFacePolygon] polygon-clipping error:", error);
      return null;
    }
  } else {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;
    const ux = dx / len;
    const uy = dy / len;

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
