// Computes the auto-slope parameters for a polygon bounded by two adjacent
// polygons at different altitudes (see findAdjacentPolygonEdges for the
// neighborEdges shape). The neighbor's top altitude at the shared edge is
// offsetZ + height + average resolved offsetTop of its refs on the chain, so
// a neighbor that is itself sloped (ramp-derived offsetTop) is handled.
//
// Returns { ok: true, offsetZ, slopePct, mLow, mHigh } where mLow/mHigh are
// the shared-edge midpoints in pixel space (guide line goes low -> high,
// matching getGuideLineRampSampler's first-point-is-low convention), or
// { ok: false, errorCode: "SAME_MIDPOINT" } when the midpoints coincide.

// Point at half the chain's cumulative arc length: stays on the shared edge
// even for L-shaped chains (equals the segment midpoint for 2-point chains).
function getChainMidpoint(chain) {
  if (chain.length === 1) return { x: chain[0].x, y: chain[0].y };

  const totalLength = chain.reduce(
    (sum, p, i) =>
      i === 0 ? 0 : sum + Math.hypot(p.x - chain[i - 1].x, p.y - chain[i - 1].y),
    0
  );
  if (totalLength <= 0) return { x: chain[0].x, y: chain[0].y };

  let remaining = totalLength / 2;
  for (let i = 1; i < chain.length; i += 1) {
    const a = chain[i - 1];
    const b = chain[i];
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (segment >= remaining) {
      const t = segment > 0 ? remaining / segment : 0;
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
    remaining -= segment;
  }
  const last = chain[chain.length - 1];
  return { x: last.x, y: last.y };
}

// Neighbor refs matching the chain, by shared id or coincident coords —
// drawn polygons often duplicate coincident points under distinct ids
// (same real-world tolerance as findAdjacentPolygonEdges).
function getNeighborTopAtChain({ neighbor, chain }, thresholdPx) {
  const thresholdSq = thresholdPx * thresholdPx;
  const chainIds = new Set(chain.map((p) => p.id));
  const refs = (neighbor.points ?? []).filter(
    (p) =>
      chainIds.has(p.id) ||
      (p.x != null &&
        chain.some((c) => {
          const dx = c.x - p.x;
          const dy = c.y - p.y;
          return dx * dx + dy * dy <= thresholdSq;
        }))
  );
  const avgOffsetTop = refs.length
    ? refs.reduce((sum, p) => sum + (p.offsetTop ?? 0), 0) / refs.length
    : 0;
  return (neighbor.offsetZ ?? 0) + (neighbor.height ?? 0) + avgOffsetTop;
}

export default function computeAutoSlopeFromNeighbors({
  neighborEdges,
  meterByPx,
  thresholdCm = 1,
}) {
  const thresholdPx = thresholdCm / 100 / meterByPx;
  const edges = neighborEdges.map((edge) => ({
    top: getNeighborTopAtChain(edge, thresholdPx),
    midpoint: getChainMidpoint(edge.chain),
  }));

  const [a, b] = edges;
  const low = a.top <= b.top ? a : b;
  const high = a.top <= b.top ? b : a;

  const lengthM =
    Math.hypot(high.midpoint.x - low.midpoint.x, high.midpoint.y - low.midpoint.y) *
    meterByPx;
  if (!(lengthM > 1e-6)) return { ok: false, errorCode: "SAME_MIDPOINT" };

  const slopePct =
    Math.round(((100 * (high.top - low.top)) / lengthM) * 1000) / 1000;

  return {
    ok: true,
    offsetZ: low.top,
    slopePct,
    mLow: low.midpoint,
    mHigh: high.midpoint,
  };
}
