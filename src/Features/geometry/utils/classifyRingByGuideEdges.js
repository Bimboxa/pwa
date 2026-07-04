import subdivideRingByForeignProjections from "./subdivideRingByForeignProjections.js";

// Min |cos| between a ring sub-edge and a guide edge: near-parallel edges
// only (same rule as the frontier detection), so perpendicular edges merely
// grazing a guide corner never match.
const PARALLEL_MIN_COS = 0.7;

// A non-matching run sandwiched between two matching runs is absorbed when
// its total length is below this many times the detection tolerance. Covers
// the small gaps left at the junction of two guide polylines (band corners).
const MERGE_GAP_FACTOR = 3;

/**
 * Clamped point-to-segment distance (always returns a number, t ∈ [0,1]).
 */
function distPointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return Math.hypot(px - ax, py - ay);

  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq)
  );
  const projX = ax + t * abx;
  const projY = ay + t * aby;
  return Math.hypot(px - projX, py - projY);
}

/**
 * True when the sub-edge (a, b) runs along ONE guide edge: both endpoints
 * and the midpoint within (tolPx + edge padPx) of the SAME edge, with
 * near-parallel orientation (same test as the frontier sub-edge detection).
 * A guide edge may carry `padPx` (its rendered band half-extent) so a
 * sub-edge glued anywhere across the band matches.
 */
export function isSubEdgeAlongGuideEdges(a, b, guideEdges, tolPx) {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uLen = Math.hypot(ux, uy);
  if (uLen < 1e-9) return false;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;

  for (const e of guideEdges) {
    const tol = tolPx + (e.padPx || 0);
    if (distPointToSegment(a.x, a.y, e.ax, e.ay, e.bx, e.by) > tol) continue;
    if (distPointToSegment(b.x, b.y, e.ax, e.ay, e.bx, e.by) > tol) continue;
    if (distPointToSegment(mx, my, e.ax, e.ay, e.bx, e.by) > tol) continue;

    const vx = e.bx - e.ax;
    const vy = e.by - e.ay;
    const vLen = Math.hypot(vx, vy);
    if (vLen < 1e-9) continue;
    const cos = Math.abs(ux * vx + uy * vy) / (uLen * vLen);
    if (cos < PARALLEL_MIN_COS) continue;

    return true;
  }
  return false;
}

// Append the first point (same object reference) so the closing edge is part
// of the chain and downstream `chain[0] === chain[last]` cyclic checks hold.
function toCyclicChain(ring) {
  return [...ring, ring[0]];
}

/**
 * Absorb short non-matching runs sandwiched between two matching runs
 * (circular). Mutates matchedEdges in place. Only called on mixed
 * classifications, so an anchor matching edge always exists.
 */
function mergeShortGapRuns(matchedEdges, ring, maxGapPx) {
  const N = matchedEdges.length;
  let anchor = 0;
  while (anchor < N && !matchedEdges[anchor]) anchor++;
  if (anchor === N) return;

  let k = 0;
  while (k < N) {
    const idx = (anchor + k) % N;
    if (matchedEdges[idx]) {
      k++;
      continue;
    }
    // False run start: bounded by matching edges on both sides (the scan is
    // anchored on a matching edge and wraps back to it).
    const runStart = k;
    let lenPx = 0;
    while (k < N && !matchedEdges[(anchor + k) % N]) {
      const p1 = ring[(anchor + k) % N];
      const p2 = ring[(anchor + k + 1) % N];
      lenPx += Math.hypot(p2.x - p1.x, p2.y - p1.y);
      k++;
    }
    if (lenPx <= maxGapPx) {
      for (let j = runStart; j < k; j++) {
        matchedEdges[(anchor + j) % N] = true;
      }
    }
  }
}

/**
 * Classify a closed ring against a set of guide edges (e.g. the band contour
 * of COTE:EXT polylines): sub-edges running along a guide edge are exterior,
 * every other sub-edge is interior.
 *
 * The ring is first subdivided by projecting the guide-edge vertices onto it
 * (within tolPx), so partial matches are delimited by explicit transition
 * points; then each sub-edge is tagged and consecutive same-tag runs are
 * walked into chains (adjacent chains share their boundary point objects).
 *
 * @param {Array<{x,y,id?}>} ringPoints - closed ring, open array (last ≠ first)
 * @param {Array<{ax,ay,bx,by,padPx?}>} guideEdges - guide segments (pixels);
 *   padPx widens the match tolerance by the guide's band half-extent
 * @param {number} tolPx - base detection tolerance (pixels)
 * @returns {{matched: boolean, extChains: Array<Array<{x,y}>>, intChains: Array<Array<{x,y}>>}}
 *   `matched` is true when at least one sub-edge runs along a guide edge.
 *   A full single-class ring is returned as ONE cyclic chain
 *   (chain[0] === chain[last], same object reference).
 */
export default function classifyRingByGuideEdges(
  ringPoints,
  guideEdges,
  tolPx
) {
  if (!ringPoints || ringPoints.length < 3) {
    return { matched: false, extChains: [], intChains: [] };
  }
  if (!guideEdges?.length || !(tolPx > 0)) {
    return {
      matched: false,
      extChains: [],
      intChains: [toCyclicChain(ringPoints)],
    };
  }

  // Subdivision must see every guide vertex whose padded tolerance could
  // make a sub-edge match, so the projection detection uses the widest pad.
  let maxPadPx = 0;
  for (const e of guideEdges) {
    if (e.padPx > maxPadPx) maxPadPx = e.padPx;
  }
  const ring = subdivideRingByForeignProjections(
    ringPoints,
    guideEdges,
    tolPx + maxPadPx
  );
  const N = ring.length;

  const matchedEdges = [];
  for (let i = 0; i < N; i++) {
    matchedEdges.push(
      isSubEdgeAlongGuideEdges(ring[i], ring[(i + 1) % N], guideEdges, tolPx)
    );
  }

  if (!matchedEdges.some(Boolean)) {
    return { matched: false, extChains: [], intChains: [toCyclicChain(ring)] };
  }

  if (!matchedEdges.every(Boolean)) {
    mergeShortGapRuns(matchedEdges, ring, tolPx * MERGE_GAP_FACTOR);
  }

  if (matchedEdges.every(Boolean)) {
    return { matched: true, extChains: [toCyclicChain(ring)], intChains: [] };
  }

  // Walk consecutive same-tag runs, starting at the first transition so no
  // run is split in the middle (same walk as the cut reclassification).
  let startEdge = 0;
  for (let i = 0; i < N; i++) {
    if (matchedEdges[i] !== matchedEdges[(i + 1) % N]) {
      startEdge = (i + 1) % N;
      break;
    }
  }

  const extChains = [];
  const intChains = [];
  let visited = 0;

  while (visited < N) {
    const edgeIdx = (startEdge + visited) % N;
    const isExt = matchedEdges[edgeIdx];

    const runPoints = [ring[edgeIdx]];
    let count = 0;
    while (visited + count < N) {
      const ei = (startEdge + visited + count) % N;
      if (matchedEdges[ei] !== isExt) break;
      runPoints.push(ring[(ei + 1) % N]);
      count++;
    }

    if (isExt) {
      extChains.push(runPoints);
    } else {
      intChains.push(runPoints);
    }

    visited += count;
  }

  return { matched: true, extChains, intChains };
}
