import { polygonCentroid2d } from "./computeFaceArea.js";
import pointInPolygon2d from "./pointInPolygon2d.js";

// Where to stick a label on a 2D polygon-with-holes: the centroid when it
// actually lands ON the material, otherwise the point of the polygon furthest
// from any edge (the "pole of inaccessibility").
//
// The centroid of a ring falls in the middle of its hole, and the centroid of
// an L or a U falls outside the material altogether — the label then floats in
// the void with nothing to attach it to.
//
// Keeping the centroid whenever it is valid matters: a user-placed
// `labelOffset` is persisted RELATIVE to the anchor, so moving the anchor of
// every maille would shift every hand-placed label. Only the broken ones move.
//
// Pure (no three.js), plane coordinates (meters).

// Initial sampling of the bbox, then a shrinking 3x3 local search: cheaper
// than the quadtree of the classic algorithm and precise enough to place a
// card, since it only runs on the mailles whose centroid is off the material.
const GRID = 16;
const REFINE_STEPS = 10;

function distToSegment2d(p, a, b) {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const lenSq = ex * ex + ey * ey;
  let t = 0;
  if (lenSq > 0) {
    t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  return Math.hypot(p.x - (a.x + t * ex), p.y - (a.y + t * ey));
}

function isOnMaterial(p, contour, holes) {
  if (!pointInPolygon2d(p, contour)) return false;
  return !holes.some((hole) => pointInPolygon2d(p, hole));
}

// Distance to the nearest edge, negative outside the material: maximizing it
// walks to the point that is the most comfortably inside.
function signedEdgeDist(p, contour, holes) {
  let dist = Infinity;
  for (const loop of [contour, ...holes]) {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const d = distToSegment2d(p, loop[i], loop[(i + 1) % n]);
      if (d < dist) dist = d;
    }
  }
  return isOnMaterial(p, contour, holes) ? dist : -dist;
}

/**
 * @param {Array<{x,y}>} contour - outer loop (open)
 * @param {Array<Array<{x,y}>>} [holes]
 * @returns {{x,y}} a point on the polygon (falls back to the centroid when the
 *   polygon is degenerate)
 */
export default function getPolygonLabelPoint(contour, holes = []) {
  const centroid = polygonCentroid2d(contour);
  if (!contour?.length) return centroid;

  const loops = holes.filter((hole) => hole?.length >= 3);
  if (isOnMaterial(centroid, contour, loops)) return centroid;

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
  const width = maxX - minX;
  const height = maxY - minY;
  if (!(width > 0) || !(height > 0)) return centroid;

  let best = null;
  let bestDist = -Infinity;
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const p = {
        x: minX + ((i + 0.5) * width) / GRID,
        y: minY + ((j + 0.5) * height) / GRID,
      };
      const d = signedEdgeDist(p, contour, loops);
      if (d > bestDist) {
        bestDist = d;
        best = p;
      }
    }
  }
  if (!best) return centroid;

  let step = Math.max(width, height) / GRID;
  for (let iter = 0; iter < REFINE_STEPS; iter++) {
    step /= 2;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const p = { x: best.x + dx * step, y: best.y + dy * step };
        const d = signedEdgeDist(p, contour, loops);
        if (d > bestDist) {
          bestDist = d;
          best = p;
        }
      }
    }
  }

  return bestDist > 0 ? best : centroid;
}
