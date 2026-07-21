// Finds the POLYGON annotations adjacent to a selected polygon. Adjacency =
// sharing at least one full edge on the selected polygon's MAIN ring, i.e. a
// run of >= 2 consecutive ring points lying on the neighbor's main-ring
// boundary. A ring point matches when it references the same db.points id as
// a neighbor vertex OR sits within thresholdCm (real-world, converted to px
// via meterByPx) of the neighbor's boundary (vertex or segment) — drawn
// polygons often duplicate coincident points under distinct ids, so id
// equality alone is not enough. Works on resolved (pixel-space) annotations;
// cuts/innerPoints are ignored.
//
// Returns [{ neighbor, chain }] where chain = the selected ring's resolved
// points ({id, x, y, ...}) forming the longest maximal shared run with that
// neighbor (wrap-around runs across the ring seam count as one chain).

const DEFAULT_THRESHOLD_CM = 1;

function dedupeRing(points) {
  const ring = [];
  for (const p of points ?? []) {
    if (!p?.id || p.x == null || p.y == null) continue;
    if (ring.length && ring[ring.length - 1].id === p.id) continue;
    ring.push(p);
  }
  // remove closing duplicate (last point repeating the first)
  if (ring.length > 1 && ring[0].id === ring[ring.length - 1].id) ring.pop();
  return ring;
}

function distSqToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  let t = 0;
  if (lenSq > 0) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const dx = p.x - (a.x + t * abx);
  const dy = p.y - (a.y + t * aby);
  return dx * dx + dy * dy;
}

function isOnRingBoundary(p, ring, thresholdSq) {
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (distSqToSegment(p, a, b) <= thresholdSq) return true;
  }
  return false;
}

function chainArcLength(chain) {
  let length = 0;
  for (let i = 1; i < chain.length; i += 1) {
    length += Math.hypot(
      chain[i].x - chain[i - 1].x,
      chain[i].y - chain[i - 1].y
    );
  }
  return length;
}

// Maximal circular runs of shared ring indices, longest first (by arc length,
// tie-broken by point count). A run crossing the seam (N-1 -> 0) is one run.
function getLongestSharedChain(ring, sharedFlags) {
  const N = ring.length;
  if (sharedFlags.every(Boolean)) return ring.slice();

  const chains = [];
  for (let start = 0; start < N; start += 1) {
    if (!sharedFlags[start] || sharedFlags[(start - 1 + N) % N]) continue;
    const chain = [];
    for (let k = 0; k < N && sharedFlags[(start + k) % N]; k += 1) {
      chain.push(ring[(start + k) % N]);
    }
    if (chain.length >= 2) chains.push(chain);
  }
  chains.sort(
    (a, b) => chainArcLength(b) - chainArcLength(a) || b.length - a.length
  );
  return chains[0] ?? null;
}

export default function findAdjacentPolygonEdges({
  selectedAnnotation,
  candidates,
  meterByPx,
  thresholdCm = DEFAULT_THRESHOLD_CM,
}) {
  const ring = dedupeRing(selectedAnnotation?.points);
  if (ring.length < 2 || !meterByPx || meterByPx <= 0) return [];

  const thresholdPx = thresholdCm / 100 / meterByPx;
  const thresholdSq = thresholdPx * thresholdPx;

  const result = [];
  for (const neighbor of candidates ?? []) {
    const neighborRing = dedupeRing(neighbor?.points);
    if (neighborRing.length < 2) continue;
    const neighborIds = new Set(neighborRing.map((p) => p.id));

    const sharedFlags = ring.map(
      (p) =>
        neighborIds.has(p.id) ||
        isOnRingBoundary(p, neighborRing, thresholdSq)
    );
    const chain = getLongestSharedChain(ring, sharedFlags);
    if (chain) result.push({ neighbor, chain });
  }
  return result;
}
