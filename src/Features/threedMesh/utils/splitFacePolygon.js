import polygonClipping from "polygon-clipping";

import { polygonArea2d } from "./computeFaceArea.js";

// Straight-cut split of a 2D polygon-with-holes (face loops projected in
// their plane basis). Unlike geometry/utils/splitPolygonByPolyline (which is
// annotation-oriented: point-id reconciliation, 0-1 coords, exterior ring
// only), this works in meters, keeps the full MultiPolygon structure (holes
// survive the cut) and can return more than two pieces (cutting a concave
// polygon can disconnect one side).

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

/**
 * Split a 2D polygon-with-holes by the straight line through (a, b).
 *
 * @param {object} args
 * @param {Array<{x,y}>} args.contour - outer loop (open)
 * @param {Array<Array<{x,y}>>} [args.holes]
 * @param {{x,y}} args.a - cut segment start (plane 2D coords, meters)
 * @param {{x,y}} args.b - cut segment end
 * @param {boolean} [args.clampToSegment] - free cut: only the [a, b] segment
 *   cuts (still extended by a hair so endpoints sitting exactly on edges cut
 *   through them); default cuts along the full infinite line.
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
  const extend = clampToSegment ? diag * 1e-6 : diag * 2;
  const offset = diag * 2;

  // Half-plane band on one side of the (extended) cut segment.
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

  const subject = [[closeRing(contour), ...holes.map(closeRing)]];
  const bandGeom = [[closeRing(band)]];

  let side1;
  let side2;
  try {
    side1 = polygonClipping.intersection(subject, bandGeom);
    side2 = polygonClipping.difference(subject, bandGeom);
  } catch (error) {
    console.error("[splitFacePolygon] polygon-clipping error:", error);
    return null;
  }

  const pieces = [...toPieces(side1), ...toPieces(side2)];
  if (pieces.length < 2) return null;

  // Ignore slivers born from numerical noise along the cut.
  const minArea = diag * diag * 1e-9;
  const solid = pieces.filter((piece) => piece.area > minArea);
  if (solid.length < 2) return null;

  return solid.sort((p1, p2) => p2.area - p1.area);
}
