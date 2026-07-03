import subdivideChainByForeignProjections from "./subdivideChainByForeignProjections.js";

// Max distance (meters) between a chain sub-edge and a neighbor floor edge
// for the sub-edge to be treated as a shared "frontier" (no geometry emitted).
export const FRONTIER_DETECTION_M = 0.05;

// Tolerance (px) for the "sub-edge lies on an exempt source line" test —
// same value as the hidden-segment matching in fromPolygonsToBim.
const EXEMPT_TOL_PX = 0.5;

// Min |cos| between a sub-edge and the frontier candidate edge: near-parallel
// edges only, so perpendicular edges merely grazing a neighbor corner are
// not dropped.
const PARALLEL_MIN_COS = 0.7;

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
 * True when both sub-edge endpoints lie on one of the exempt source lines
 * (user-tagged isExtEdge / isIntEdge segments — manual tags win over the
 * automatic frontier detection).
 */
function isOnExemptLine(a, b, exemptLines) {
  if (!exemptLines?.length) return false;
  return exemptLines.some(
    (l) =>
      distPointToSegment(a.x, a.y, l.ax, l.ay, l.bx, l.by) <= EXEMPT_TOL_PX &&
      distPointToSegment(b.x, b.y, l.ax, l.ay, l.bx, l.by) <= EXEMPT_TOL_PX
  );
}

/**
 * True when the sub-edge (a, b) runs along ONE frontier edge: both endpoints
 * and the midpoint within frontierPx of the SAME edge, with near-parallel
 * orientation. No outward-normal directional check: at frontier distances
 * (~5 cm) the edges are near-coincident and a normal test is unstable; the
 * same-edge + parallelism condition rejects perpendicular grazing corners.
 */
function isFrontierSubEdge(a, b, frontierEdges, frontierPx) {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uLen = Math.hypot(ux, uy);
  if (uLen < 1e-9) return false;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;

  for (const e of frontierEdges) {
    if (distPointToSegment(a.x, a.y, e.ax, e.ay, e.bx, e.by) > frontierPx)
      continue;
    if (distPointToSegment(b.x, b.y, e.ax, e.ay, e.bx, e.by) > frontierPx)
      continue;
    if (distPointToSegment(mx, my, e.ax, e.ay, e.bx, e.by) > frontierPx)
      continue;

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

/**
 * Drop chain sub-edges shared with a neighbor floor polygon ("frontier"
 * edges). Each chain is first subdivided by projecting the frontier-edge
 * vertices onto it (within frontierPx), so the shared span is delimited by
 * explicit points; then every sub-edge running along a frontier edge is cut
 * out, exactly like hidden segments (endpoints kept as ends of the adjacent
 * sub-chains, runs < 2 points dropped).
 *
 * @param {Array<Array<{x,y}>>} chains - open polyline chains (a still-cyclic
 *   ring chain has first === last)
 * @param {Array<{ax,ay,bx,by}>} frontierEdges - edges of the neighbor
 *   SOL / SOL_PROXY polygons
 * @param {number} frontierPx - FRONTIER_DETECTION_M converted to pixels
 * @param {Array<{ax,ay,bx,by}>|null} [exemptLines] - user-tagged segment
 *   lines that must never be dropped (manual tags win)
 * @returns {{chains: Array<Array<{x,y}>>, removed: boolean}}
 */
export default function splitChainsAtFrontierEdges(
  chains,
  frontierEdges,
  frontierPx,
  exemptLines = null
) {
  if (!frontierEdges?.length || !(frontierPx > 0)) {
    return { chains, removed: false };
  }

  const result = [];
  let removed = false;

  for (const chain of chains) {
    if (chain.length < 2) continue;

    const subdivided = subdivideChainByForeignProjections(
      chain,
      frontierEdges,
      frontierPx
    );

    let current = [subdivided[0]];
    for (let i = 1; i < subdivided.length; i++) {
      const prev = subdivided[i - 1];
      const curr = subdivided[i];
      const isFrontier =
        !isOnExemptLine(prev, curr, exemptLines) &&
        isFrontierSubEdge(prev, curr, frontierEdges, frontierPx);
      if (isFrontier) {
        removed = true;
        if (current.length >= 2) result.push(current);
        current = [curr];
      } else {
        current.push(curr);
      }
    }
    if (current.length >= 2) result.push(current);
  }

  return { chains: result, removed };
}
