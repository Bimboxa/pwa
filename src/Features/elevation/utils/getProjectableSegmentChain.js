// Builds the chain of segments whose elevation is drawn, starting from the
// principal (seed) segment and projecting onto its line.
//
// Rules (so the projected profile stays readable):
//   - Extend forward/backward while segments keep ADVANCING along the line.
//   - Stop on a ~90° turn (segment near-perpendicular to the line).
//   - A segment that REVERSES (folds back) is included ONLY when it forms a
//     "Z": it goes back diagonally and the contour immediately resumes forward
//     past the current frontier. That single returning segment is taken and the
//     chain stops there — so there is never more than one overlapping segment.
//   - A U-turn (reverses without resuming forward) stops the chain.

// dot of segment i's unit direction (points[i] -> points[(i+1)%n]) with the
// line. `i` may be an unrolled index; it is wrapped modulo n.
function segDot(points, i, ux, uy) {
  const n = points.length;
  const p = points[((i % n) + n) % n];
  const q = points[(((i + 1) % n) + n) % n];
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return (dx * ux + dy * uy) / len;
}

export default function getProjectableSegmentChain(
  points,
  seedSegmentIndex,
  { perpAngleDeg = 10, closeLine = false } = {}
) {
  if (!Array.isArray(points) || points.length < 2) return [];

  const n = points.length;
  // segment i connects points[i] -> points[(i + 1) % n]; a closed polyline has
  // one extra (closing) segment, index n - 1.
  const nSeg = closeLine ? n : n - 1;
  const mod = (k) => ((k % n) + n) % n;
  let seed = seedSegmentIndex;
  if (seed == null || seed < 0) seed = 0;
  if (seed > nSeg - 1) seed = nSeg - 1;

  const a = points[seed];
  const b = points[mod(seed + 1)];
  let ux = b.x - a.x;
  let uy = b.y - a.y;
  const ulen = Math.hypot(ux, uy);
  if (ulen < 1e-9) return [seed];
  ux /= ulen;
  uy /= ulen;

  // projection of each point onto the line (origin = seed start). Indexed by
  // (wrapped) point index via projOf so unrolled indices work when closed.
  const proj = points.map((p) => (p.x - a.x) * ux + (p.y - a.y) * uy);
  const projOf = (k) => proj[mod(k)];
  const PERP = Math.sin((perpAngleDeg * Math.PI) / 180);

  // start/end are unrolled point indices: the chain covers points [start .. end]
  // => segments [start .. end-1]; they are wrapped modulo n only when emitted.
  let start = seed;
  let end = seed + 1;

  // index bounds: open polylines stay within [0 .. nSeg-1]; closed ones may walk
  // an unrolled window spanning at most a full ring around the seed.
  const fwdEnd = closeLine ? seed + nSeg : nSeg; // exclusive upper bound on i
  const bwdEnd = closeLine ? seed - nSeg : -1; // exclusive lower bound on i

  // forward
  let frontier = projOf(seed + 1);
  for (let i = seed + 1; i < fwdEnd; i++) {
    const c = segDot(points, i, ux, uy);
    if (c == null) break;
    if (Math.abs(c) <= PERP) break; // ~90° -> stop
    if (c > 0) {
      if (projOf(i + 1) > frontier) {
        end = i + 1;
        frontier = projOf(i + 1);
        continue;
      }
      break;
    }
    // c < -PERP: reverse -> Z only if the next segment resumes forward past the frontier
    const cNext = i + 1 < fwdEnd ? segDot(points, i + 1, ux, uy) : null;
    if (cNext != null && cNext > 0 && projOf(i + 2) > frontier) {
      end = i + 1; // take the returning (Z) segment, then stop
    }
    break;
  }

  // backward
  let frontierB = projOf(seed);
  for (let i = seed - 1; i > bwdEnd; i--) {
    const c = segDot(points, i, ux, uy);
    if (c == null) break;
    if (Math.abs(c) <= PERP) break; // ~90° -> stop
    if (c > 0) {
      if (projOf(i) < frontierB) {
        start = i;
        frontierB = projOf(i);
        continue;
      }
      break;
    }
    // c < -PERP: reverse -> Z only if the previous segment resumes backward
    const cPrev = i - 1 > bwdEnd ? segDot(points, i - 1, ux, uy) : null;
    if (cPrev != null && cPrev > 0 && projOf(i - 1) < frontierB) {
      start = i; // take the returning (Z) segment, then stop
    }
    break;
  }

  const chain = [];
  for (let s = start; s <= end - 1; s++) chain.push(mod(s));
  return chain;
}
