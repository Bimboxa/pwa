// Pure math for editing ONE segment length of a POLYLINE / POLYGON / STRIP
// contour, under per-segment and per-point lock constraints.
//
// Dependency free (plain {x, y} objects) so it can be replayed in node.
// Generalizes computeRulerLengthEdit to closed chains and arbitrary locks.
//
// `points`               resolved pixel points, in order (no duplicated
//                        closing point for closed chains)
// `closed`               true for POLYGON (and POLYLINE/STRIP with closeLine)
// `segmentIndex`         edited segment k: points[k] → points[(k+1) % n]
//                        (k in 0..n-2 open, 0..n-1 closed)
// `targetPx`             the new segment length, in pixels
// `lockedSegmentIndexes` Set<number> — segments whose LENGTH must stay fixed
// `lockedPointIndexes`   Set<number> — points that must NOT move
//
// Model: the edited segment keeps its direction; one endpoint (the anchor)
// stays put, the other (M) moves. Point locks pick M (both locked = conflict;
// none locked = the END point moves, downstream in drawing order). The delta
// then propagates away from the anchor: consecutive locked segments translate
// rigidly, the first unlocked segment absorbs it. A locked point met during a
// rigid run is a conflict. On a closed chain the walk wraps and the segment
// arriving back at the anchor is the last possible absorber.
//
// `anglesLocked` (the global angle padlock) changes HOW the first unlocked
// segment absorbs: instead of swinging (near end dragged, far end fixed —
// which breaks the joint angles), its far point SLIDES to the intersection of
// its two direction-preserved edges, so every joint angle survives and a
// rectangle stays a rectangle. Rigid runs already preserve angles; a missing
// or parallel neighbour falls back to a rigid translation.
//
// Returns { ok: true, moves: [{ index, x, y }] }
//       | { ok: false, reason: "BOTH_ENDPOINTS_LOCKED" | "LOCKED_CHAIN"
//                             | "DEGENERATE_SEGMENT" | "INVALID_INPUT" }

// Infinite line (p, dp) × infinite line (q, dq) → point or null when parallel.
// (Local copy: this module stays import-free so it can be replayed in node.)
function lineIntersection(p, dp, q, dq) {
  const cross = dp.x * dq.y - dp.y * dq.x;
  if (Math.abs(cross) < 1e-9) return null;
  const t = ((q.x - p.x) * dq.y - (q.y - p.y) * dq.x) / cross;
  return { x: p.x + dp.x * t, y: p.y + dp.y * t };
}

export default function computeSegmentLengthEdit({
  points,
  closed = false,
  segmentIndex,
  targetPx,
  lockedSegmentIndexes = new Set(),
  lockedPointIndexes = new Set(),
  anglesLocked = false,
}) {
  const n = points?.length ?? 0;
  const maxSegmentIndex = closed ? n - 1 : n - 2;
  if (n < 2) return { ok: false, reason: "INVALID_INPUT" };
  if (!Number.isFinite(targetPx) || targetPx <= 0)
    return { ok: false, reason: "INVALID_INPUT" };
  if (segmentIndex < 0 || segmentIndex > maxSegmentIndex)
    return { ok: false, reason: "INVALID_INPUT" };

  const startIndex = segmentIndex;
  const endIndex = (segmentIndex + 1) % n;

  const startLocked = lockedPointIndexes.has(startIndex);
  const endLocked = lockedPointIndexes.has(endIndex);
  if (startLocked && endLocked)
    return { ok: false, reason: "BOTH_ENDPOINTS_LOCKED" };

  // Default (no endpoint lock): the END point moves, downstream in drawing
  // order — one fixed, learnable rule, matching how the chain was drawn.
  const movedIndex = startLocked ? endIndex : endLocked ? startIndex : endIndex;
  const anchorIndex = movedIndex === endIndex ? startIndex : endIndex;
  const anchor = points[anchorIndex];
  const moved = points[movedIndex];
  if (!anchor || !moved) return { ok: false, reason: "INVALID_INPUT" };

  // The segment keeps its orientation; only its length changes.
  const dx = moved.x - anchor.x;
  const dy = moved.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { ok: false, reason: "DEGENERATE_SEGMENT" };

  const ux = dx / len;
  const uy = dy / len;
  const deltaX = anchor.x + ux * targetPx - moved.x;
  const deltaY = anchor.y + uy * targetPx - moved.y;
  if (Math.abs(deltaX) < 1e-9 && Math.abs(deltaY) < 1e-9)
    return { ok: true, moves: [] };

  const moves = [
    { index: movedIndex, x: moved.x + deltaX, y: moved.y + deltaY },
  ];

  // Propagation walk away from the anchor. dir=+1 when M is the segment's end
  // point (walk in drawing order), -1 otherwise. The segment between prev and
  // cur is indexed min(prev, cur) in drawing order, i.e. prev when dir=+1 and
  // cur when dir=-1 (modular on closed chains).
  const dir = movedIndex === endIndex ? 1 : -1;
  let prev = movedIndex;
  let prevNew = moves[0];
  for (;;) {
    const rawCur = prev + dir;
    if (!closed && (rawCur < 0 || rawCur > n - 1)) break; // rigid tail — valid
    const cur = ((rawCur % n) + n) % n;
    const seg = dir === 1 ? prev : cur;

    if (!lockedSegmentIndexes.has(seg)) {
      // First unlocked segment absorbs the delta.
      if (!anglesLocked) break; // plain absorb: near end dragged, far end fixed

      // Angle-locked absorb: `cur` SLIDES to the intersection of its two
      // direction-preserved edges (incoming through the moved prev, outgoing
      // through its untouched far neighbour). The outgoing edge only changes
      // length, so every joint angle survives.
      if (cur === anchorIndex) break; // segment back into the anchor: nothing can slide
      const dirIn = {
        x: points[cur].x - points[prev].x,
        y: points[cur].y - points[prev].y,
      };
      const rawW = cur + dir;
      const wExists = closed || (rawW >= 0 && rawW <= n - 1);
      const wIndex = wExists ? ((rawW % n) + n) % n : -1;
      const W = wIndex >= 0 && wIndex !== prev ? points[wIndex] : null;
      let next = null;
      if (W && Math.hypot(dirIn.x, dirIn.y) > 1e-9) {
        const dirOut = { x: points[cur].x - W.x, y: points[cur].y - W.y };
        if (Math.hypot(dirOut.x, dirOut.y) > 1e-9) {
          next = lineIntersection(prevNew, dirIn, W, dirOut);
        }
      }
      if (next) {
        if (
          Math.abs(next.x - points[cur].x) < 1e-9 &&
          Math.abs(next.y - points[cur].y) < 1e-9
        )
          break; // nothing to move
        if (lockedPointIndexes.has(cur))
          return { ok: false, reason: "LOCKED_CHAIN" };
        moves.push({ index: cur, x: next.x, y: next.y });
        break;
      }
      // Open-chain end, collinear joint or degenerate edge → rigid
      // translation (keeps both the direction and the angles) and the walk
      // continues looking for an absorber further down.
      if (lockedPointIndexes.has(cur))
        return { ok: false, reason: "LOCKED_CHAIN" };
      const translated = {
        index: cur,
        x: points[cur].x + deltaX,
        y: points[cur].y + deltaY,
      };
      moves.push(translated);
      prev = cur;
      prevNew = translated;
      continue;
    }

    // Rigid run: seg keeps its length AND prev just moved → cur must translate
    // too. Hitting a locked point (or wrapping back onto the anchor) means
    // nothing can absorb the delta.
    if (cur === anchorIndex || lockedPointIndexes.has(cur))
      return { ok: false, reason: "LOCKED_CHAIN" };
    const translated = {
      index: cur,
      x: points[cur].x + deltaX,
      y: points[cur].y + deltaY,
    };
    moves.push(translated);
    prev = cur;
    prevNew = translated;
  }

  return { ok: true, moves };
}
