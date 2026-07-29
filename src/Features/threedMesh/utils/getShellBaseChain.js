// Base contour of a shell maille: the polyline supporting the "développé"
// metric of the vertical cut guide (see chainAbscissa.js).
//
// The base is found in the shell's boundary loops (extractBoundaryLoops3d):
// - a virgin or merely OPENED revolution has two closed rings (the seam edges
//   stay welded, so opening a ring does not merge its loops) → the lowest
//   ring, closed;
// - a piece really SPLIT off carries ONE loop mixing the base, the top and
//   near-vertical "sides" (former cut lines / free ends of an open ribbon) →
//   the sides are stripped and the lowest remaining arc is the base, open.
//
// A side is a run of consecutive steep edges (|dy| >= horizontal length,
// i.e. > 45°) whose vertical extent reaches half the loop height: stair
// risers stay in the base (a riser is far below half the shell height), full
// height cut edges do not. A base steeper than 45° over half the shell height
// is misclassified — callers then get null and show no guide, never a wrong
// metric.
//
// Pure (no three.js), world coordinates, +Y up.

const SIDE_MIN_HEIGHT_FRACTION = 0.5;

const isSteepEdge = (p, q) =>
  Math.abs(q.y - p.y) >= Math.hypot(q.x - p.x, q.z - p.z);

/**
 * @param {object} args
 * @param {[[{x,y,z}]]} args.boundaries - shell boundary loops (open storage,
 *   no closing duplicate)
 * @returns {{points: [{x,y,z}], closed: boolean} | null}
 */
export default function getShellBaseChain({ boundaries }) {
  const loops = (boundaries || []).filter((loop) => loop?.length >= 2);
  if (!loops.length) return null;

  const meanY = (loop) => loop.reduce((sum, p) => sum + p.y, 0) / loop.length;
  let base = loops[0];
  for (const loop of loops) {
    if (meanY(loop) < meanY(base)) base = loop;
  }

  const n = base.length;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of base) {
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  const height = yMax - yMin;

  const steep = [];
  for (let i = 0; i < n; i++) {
    steep.push(isSteepEdge(base[i], base[(i + 1) % n]));
  }

  const firstFlat = steep.indexOf(false);
  if (firstFlat === -1) return null; // fully vertical loop: no base at all

  // Steep runs in circular order (starting at a flat edge, so no run wraps),
  // promoted to "side" — and removed — when tall enough.
  const isSide = new Array(n).fill(false);
  let run = null;
  for (let k = 0; k <= n; k++) {
    const i = (firstFlat + k) % n;
    if (k < n && steep[i]) {
      if (!run) run = { edges: [], lo: Infinity, hi: -Infinity };
      run.edges.push(i);
      for (const p of [base[i], base[(i + 1) % n]]) {
        if (p.y < run.lo) run.lo = p.y;
        if (p.y > run.hi) run.hi = p.y;
      }
      continue;
    }
    if (run) {
      if (height > 0 && run.hi - run.lo >= SIDE_MIN_HEIGHT_FRACTION * height) {
        for (const edge of run.edges) isSide[edge] = true;
      }
      run = null;
    }
  }

  if (!isSide.includes(true)) {
    return { points: base, closed: true };
  }

  // Arcs of consecutive non-side edges (circular, started on a side edge so
  // no arc wraps); the base is the arc holding the lowest vertex.
  const firstSide = isSide.indexOf(true);
  const arcs = [];
  let arc = null;
  for (let k = 0; k <= n; k++) {
    const i = (firstSide + k) % n;
    if (k < n && !isSide[i]) {
      if (!arc) arc = [base[i]];
      arc.push(base[(i + 1) % n]);
      continue;
    }
    if (arc) {
      arcs.push(arc);
      arc = null;
    }
  }

  let best = null;
  let bestLow = Infinity;
  for (const candidate of arcs) {
    if (candidate.length < 2) continue;
    const low = Math.min(...candidate.map((p) => p.y));
    if (low < bestLow) {
      bestLow = low;
      best = candidate;
    }
  }
  return best ? { points: best, closed: false } : null;
}
