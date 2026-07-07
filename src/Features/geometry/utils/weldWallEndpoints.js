/**
 * Weld the near-miss free endpoints of open wall centerlines so separate walls
 * drawn end-to-end (with small drawing gaps at the junctions) reconstitute a
 * closed loop when their offset bands are unioned.
 *
 * Only the two free endpoints of each OPEN wall participate (closed walls have
 * none). All endpoint pairs within `weldPx` are welded greedily, nearest pair
 * first, each endpoint welded at most once — so an endpoint with several
 * neighbors in range binds to the closest one. Welded endpoints move to their
 * shared midpoint, which makes the two bands overlap exactly at that point.
 *
 * Pure: input walls are never mutated; wall objects and their point arrays are
 * cloned. Exactly-coincident endpoints are unchanged (midpoint = same point),
 * so precisely-drawn loops pass through untouched.
 *
 * @param {Array<{points: Array<{x,y,type?}>, closed?: boolean}>} walls
 * @param {number} weldPx - max endpoint gap to bridge (pixels)
 * @returns {Array} new walls with welded endpoints
 */
export default function weldWallEndpoints(walls, weldPx) {
  if (!walls?.length || !(weldPx > 0)) return walls;

  const out = walls.map((w) => ({
    ...w,
    points: (w.points ?? []).map((p) => ({ ...p })),
  }));

  // Free endpoints of open walls: {wi, pi}.
  const eps = [];
  out.forEach((w, wi) => {
    if (w.closed) return;
    const n = w.points.length;
    if (n < 2) return;
    eps.push({ wi, pi: 0 });
    eps.push({ wi, pi: n - 1 });
  });

  const weldSq = weldPx * weldPx;
  const pairs = [];
  for (let i = 0; i < eps.length; i++) {
    for (let j = i + 1; j < eps.length; j++) {
      const pa = out[eps[i].wi].points[eps[i].pi];
      const pb = out[eps[j].wi].points[eps[j].pi];
      const d2 = (pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2;
      if (d2 <= weldSq) pairs.push({ i, j, d2 });
    }
  }
  pairs.sort((p, q) => p.d2 - q.d2);

  const used = new Array(eps.length).fill(false);
  for (const { i, j } of pairs) {
    if (used[i] || used[j]) continue;
    const pa = out[eps[i].wi].points[eps[i].pi];
    const pb = out[eps[j].wi].points[eps[j].pi];
    const mx = (pa.x + pb.x) / 2;
    const my = (pa.y + pb.y) / 2;
    pa.x = mx;
    pa.y = my;
    pb.x = mx;
    pb.y = my;
    used[i] = true;
    used[j] = true;
  }

  return out;
}
