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

// dot of segment i's unit direction (points[i] -> points[i+1]) with the line
function segDot(points, i, ux, uy) {
  const p = points[i];
  const q = points[i + 1];
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return (dx * ux + dy * uy) / len;
}

export default function getProjectableSegmentChain(
  points,
  seedSegmentIndex,
  { perpAngleDeg = 10 } = {}
) {
  if (!Array.isArray(points) || points.length < 2) return [];

  const nSeg = points.length - 1;
  let seed = seedSegmentIndex;
  if (seed == null || seed < 0) seed = 0;
  if (seed > nSeg - 1) seed = nSeg - 1;

  const a = points[seed];
  const b = points[seed + 1];
  let ux = b.x - a.x;
  let uy = b.y - a.y;
  const ulen = Math.hypot(ux, uy);
  if (ulen < 1e-9) return [seed];
  ux /= ulen;
  uy /= ulen;

  // projection of each point onto the line (origin = seed start)
  const proj = points.map((p) => (p.x - a.x) * ux + (p.y - a.y) * uy);
  const PERP = Math.sin((perpAngleDeg * Math.PI) / 180);

  let start = seed;
  let end = seed + 1; // chain covers points [start .. end] => segments [start .. end-1]

  // forward
  let frontier = proj[seed + 1];
  for (let i = seed + 1; i < nSeg; i++) {
    const c = segDot(points, i, ux, uy);
    if (c == null) break;
    if (Math.abs(c) <= PERP) break; // ~90° -> stop
    if (c > 0) {
      if (proj[i + 1] > frontier) {
        end = i + 1;
        frontier = proj[i + 1];
        continue;
      }
      break;
    }
    // c < -PERP: reverse -> Z only if the next segment resumes forward past the frontier
    const cNext = i + 1 < nSeg ? segDot(points, i + 1, ux, uy) : null;
    if (cNext != null && cNext > 0 && proj[i + 2] > frontier) {
      end = i + 1; // take the returning (Z) segment, then stop
    }
    break;
  }

  // backward
  let frontierB = proj[seed];
  for (let i = seed - 1; i >= 0; i--) {
    const c = segDot(points, i, ux, uy);
    if (c == null) break;
    if (Math.abs(c) <= PERP) break; // ~90° -> stop
    if (c > 0) {
      if (proj[i] < frontierB) {
        start = i;
        frontierB = proj[i];
        continue;
      }
      break;
    }
    // c < -PERP: reverse -> Z only if the previous segment resumes backward
    const cPrev = i - 1 >= 0 ? segDot(points, i - 1, ux, uy) : null;
    if (cPrev != null && cPrev > 0 && proj[i - 1] < frontierB) {
      start = i; // take the returning (Z) segment, then stop
    }
    break;
  }

  const chain = [];
  for (let s = start; s <= end - 1; s++) chain.push(s);
  return chain;
}
