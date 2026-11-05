// Break points (« points de rupture ») of an extruded line or ring.
//
// A point flagged `isBreak` on its annotation ref is an EXPLICIT break: the
// 3D build draws the vertical edge standing on it and keeps the two side
// faces it separates apart — even coplanar ones (a break in the middle of a
// straight side) or ones a smooth selection angle would join.
//
// The faces are told apart by a label per SEGMENT (segment i: point i →
// point i + 1): the runs of segments between two breaks get distinct labels,
// which the builders store per triangle (geometry.userData.triParts) for the
// Pinceau. No break → every label is 0 and nothing changes.
//
// A closed ring with a SINGLE break cannot be split by it alone (walking
// around the ring leads back to the other side of the break): the sharpest
// other corner of the ring closes the run. Its two faces already fold there,
// so the extra boundary costs nothing.

/**
 * Fold (degrees, 0 = straight on) of the line at point `i`: angle between
 * the segment arriving at it and the one leaving it. Infinity when the point
 * has no segment on one side (end of an open line) or a zero-length one.
 */
export function getFoldDeg(points, i, closed = true) {
  const n = points?.length ?? 0;
  if (n < 3) return Infinity;
  if (!closed && (i <= 0 || i >= n - 1)) return Infinity;
  const p = points[i];
  const before = points[(i - 1 + n) % n];
  const after = points[(i + 1) % n];
  const ax = p.x - before.x;
  const ay = p.y - before.y;
  const bx = after.x - p.x;
  const by = after.y - p.y;
  if (!(Math.hypot(ax, ay) > 0) || !(Math.hypot(bx, by) > 0)) return Infinity;
  return (
    (Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by) * 180) / Math.PI
  );
}

/**
 * @param {Array<{x:number, y:number, isBreak?:boolean}>} points - line or
 *   ring, arcs already expanded (only the drawn points keep `isBreak`)
 * @param {object} [options]
 * @param {boolean} [options.closed=true]
 * @returns {{labels: Array<number>, breaks: Array<number>,
 *   hasLabels: boolean}} labels: one per segment; breaks: indices of the
 *   break points that separate two segments
 */
export default function getBreakSegmentLabels(points, { closed = true } = {}) {
  const n = points?.length ?? 0;
  const segmentCount = closed ? n : Math.max(0, n - 1);
  const labels = new Array(segmentCount).fill(0);
  if (n < 3) return { labels, breaks: [], hasLabels: false };

  // The ends of an open line separate nothing.
  const breaks = [];
  for (let i = 0; i < n; i++) {
    if (!points[i]?.isBreak) continue;
    if (!closed && (i === 0 || i === n - 1)) continue;
    breaks.push(i);
  }
  if (breaks.length === 0) return { labels, breaks, hasLabels: false };

  const boundaries = [...breaks];
  if (closed && boundaries.length === 1) {
    let sharpest = -1;
    let sharpestFold = -1;
    for (let i = 0; i < n; i++) {
      if (i === boundaries[0]) continue;
      const fold = getFoldDeg(points, i, true);
      const value = Number.isFinite(fold) ? fold : 0;
      if (value > sharpestFold) {
        sharpestFold = value;
        sharpest = i;
      }
    }
    if (sharpest >= 0) boundaries.push(sharpest);
    boundaries.sort((a, b) => a - b);
  }

  // Segment i starts at point i: it belongs to the run opened by the last
  // boundary at or before i (on a ring, the run before the first boundary
  // is the end of the last one).
  const count = boundaries.length;
  let passed = 0;
  for (let i = 0; i < segmentCount; i++) {
    if (passed < count && boundaries[passed] === i) passed++;
    labels[i] = closed ? passed % count : passed;
  }
  return { labels, breaks, hasLabels: labels.some((label) => label !== 0) };
}
