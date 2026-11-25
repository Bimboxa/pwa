// Parallel (miter) offset of a CLOSED ring that maps the points 1:1: same
// count, same order, same start point — unlike offsetPolygon, whose
// polygon-clipping clean-up may reorder / drop vertices. Used where the ring
// vertices themselves move (POLYLINE <-> STRIP toggle on a closed line), so
// the per-segment flags can be re-keyed positionally.
//
// Sign convention = offsetPolygon (the closed STRIP renderer): a positive
// distance grows the ring OUTWARD, a negative one shrinks it INWARD, whatever
// the drawing direction.
//
// Returns plain { x, y } points, or null when the result is degenerate (an
// edge collapses or flips: inward offset larger than the ring allows).

const EPS = 1e-9;

// Same formula as offsetPolygon: > 0 means "left of the path" is the outside.
function getSignedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += (p2.x - p1.x) * (p2.y + p1.y);
  }
  return area / 2;
}

export default function offsetClosedRing(points, distance) {
  const n = points?.length ?? 0;
  if (n < 3) return null;

  const area = getSignedArea(points);
  if (Math.abs(area) < EPS) return null;
  const d = area > 0 ? distance : -distance;

  // Unit direction of each edge i = points[i] -> points[i + 1] (null when the
  // edge has no length).
  const dirs = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const length = Math.hypot(dx, dy);
    return length < EPS ? null : { x: dx / length, y: dy / length };
  });
  if (dirs.every((dir) => !dir)) return null;

  // A zero-length edge borrows the direction of the nearest previous edge, so
  // duplicated points stay duplicated and the mapping stays 1:1.
  const getDir = (i) => {
    for (let k = 0; k < n; k++) {
      const dir = dirs[(i - k + n) % n];
      if (dir) return dir;
    }
    return null;
  };

  const result = points.map((p, i) => {
    const prev = getDir((i - 1 + n) % n);
    const curr = getDir(i);
    // left normals (rotation +90°), as in offsetPolygon
    const nPrev = { x: -prev.y, y: prev.x };
    const nCurr = { x: -curr.y, y: curr.x };
    // miter joint: p + d * (nPrev + nCurr) / (1 + nPrev · nCurr)
    const denom = 1 + nPrev.x * nCurr.x + nPrev.y * nCurr.y;
    if (Math.abs(denom) < 1e-6) {
      // U-turn: no miter, plain perpendicular offset
      return { x: p.x + nCurr.x * d, y: p.y + nCurr.y * d };
    }
    return {
      x: p.x + (d * (nPrev.x + nCurr.x)) / denom,
      y: p.y + (d * (nPrev.y + nCurr.y)) / denom,
    };
  });

  // Degenerate when an edge collapsed or now runs backwards.
  for (let i = 0; i < n; i++) {
    const dir = dirs[i];
    if (!dir) continue;
    const a = result[i];
    const b = result[(i + 1) % n];
    if ((b.x - a.x) * dir.x + (b.y - a.y) * dir.y <= EPS) return null;
  }

  return result;
}
