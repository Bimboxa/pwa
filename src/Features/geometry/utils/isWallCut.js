// Decide whether a polygon `cut` (hole) is a wall footprint rather than a
// genuine void (e.g. a pit / "fosse").
//
// A wall footprint is a THIN elongated slot: it has a pair of near-parallel
// segments separated by less than the wall thickness. A real void is wide, so
// no parallel pair sits that close — it is kept.

const PARALLEL_SIN_TOL = 0.26; // ~15° tolerance on segment alignment
const MIN_PERP_PX = 0.5; // ignore pairs on (almost) the same line

function bbox(points) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { w: maxX - minX, h: maxY - minY };
}

/**
 * @param {Array<{x:number,y:number}>} cutPoints - cut ring vertices (open: last != first)
 * @param {number} thresholdPx - wall thickness in pixels
 * @returns {boolean} true when the cut looks like a wall footprint
 */
export default function isWallCut(cutPoints, thresholdPx) {
  if (!cutPoints || cutPoints.length < 3 || !(thresholdPx > 0)) return false;

  // Cheap pre-check: a slot whose smaller bbox dimension is below the wall
  // thickness is necessarily a wall footprint (catches axis-aligned slots).
  const { w, h } = bbox(cutPoints);
  if (Math.min(w, h) <= thresholdPx) return true;

  const N = cutPoints.length;

  for (let i = 0; i < N; i++) {
    const a = cutPoints[i];
    const b = cutPoints[(i + 1) % N];
    const e1x = b.x - a.x;
    const e1y = b.y - a.y;
    const len1 = Math.hypot(e1x, e1y);
    if (len1 < 1e-6) continue;
    const u1x = e1x / len1;
    const u1y = e1y / len1;

    for (let j = i + 1; j < N; j++) {
      // skip segments that share a vertex with segment i
      if (j === i || j === (i + 1) % N || (j + 1) % N === i) continue;

      const c = cutPoints[j];
      const d = cutPoints[(j + 1) % N];
      const e2x = d.x - c.x;
      const e2y = d.y - c.y;
      const len2 = Math.hypot(e2x, e2y);
      if (len2 < 1e-6) continue;
      const u2x = e2x / len2;
      const u2y = e2y / len2;

      // near-parallel (or anti-parallel): |sin(angle)| small
      const sin = Math.abs(u1x * u2y - u1y * u2x);
      if (sin > PARALLEL_SIN_TOL) continue;

      // perpendicular distance between the two segment lines
      const perp = Math.abs((c.x - a.x) * u1y - (c.y - a.y) * u1x);
      if (perp >= thresholdPx || perp < MIN_PERP_PX) continue;

      // require the segments to actually face each other (projection overlap
      // onto segment-1's direction), so we don't match far-apart colinear-ish
      // edges of a wide void
      const pa = 0;
      const pb = len1;
      const pc = (c.x - a.x) * u1x + (c.y - a.y) * u1y;
      const pd = (d.x - a.x) * u1x + (d.y - a.y) * u1y;
      const loC = Math.min(pc, pd);
      const hiC = Math.max(pc, pd);
      const overlap = Math.min(pb, hiC) - Math.max(pa, loC);
      if (overlap > 0) return true;
    }
  }

  return false;
}
