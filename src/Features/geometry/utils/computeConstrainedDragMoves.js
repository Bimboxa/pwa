// Pure math for EDIT-mode drags of a segment or a vertex of a POLYLINE /
// POLYGON / STRIP contour, with an optional "angle lock" that preserves the
// joint angles (a rectangle stays a rectangle).
//
// Dependency free (plain {x, y} objects) so it can be replayed in node.
//
// Angle-lock model: every edge keeps its DIRECTION except the one(s) whose
// length must change to follow the drag. Each adjusted vertex is the
// intersection of two direction-preserved lines; when the lines are parallel
// (collinear joints) or a neighbour is missing (open-chain end), the vertex
// falls back to a rigid translation by the drag delta.

// Infinite line (p, dp) × infinite line (q, dq) → point or null when parallel.
function lineIntersection(p, dp, q, dq) {
  const cross = dp.x * dq.y - dp.y * dq.x;
  if (Math.abs(cross) < 1e-9) return null;
  const t = ((q.x - p.x) * dq.y - (q.y - p.y) * dq.x) / cross;
  return { x: p.x + dp.x * t, y: p.y + dp.y * t };
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, d) => ({ x: a.x + d.x, y: a.y + d.y });
const isDegenerate = (d) => Math.hypot(d.x, d.y) < 1e-9;

// Drag segment k (P[k] → P[(k+1) % n]) by `delta` (pixels).
//
// anglesLocked=false → both endpoints translate; the adjacent segments deform.
// anglesLocked=true  → the segment's line translates; each endpoint slides to
//                      the intersection with its (direction-preserved)
//                      adjacent segment, so every joint angle is preserved.
//
// Returns [{ index, x, y }] (empty on invalid input).
export function computeSegmentDragMoves({
  points,
  closed = false,
  segmentIndex,
  delta,
  anglesLocked = true,
}) {
  const n = points?.length ?? 0;
  const maxSegmentIndex = closed ? n - 1 : n - 2;
  if (n < 2) return [];
  if (segmentIndex < 0 || segmentIndex > maxSegmentIndex) return [];
  if (!Number.isFinite(delta?.x) || !Number.isFinite(delta?.y)) return [];

  const iA = segmentIndex;
  const iB = (segmentIndex + 1) % n;
  const A = points[iA];
  const B = points[iB];
  if (!A || !B) return [];

  const dSeg = sub(B, A);
  if (!anglesLocked || n === 2 || isDegenerate(dSeg)) {
    return [
      { index: iA, ...add(A, delta) },
      { index: iB, ...add(B, delta) },
    ];
  }

  // The dragged segment's new (parallel) line passes through A + delta.
  const onNewLine = add(A, delta);

  const slideEndpoint = (endIndex, endPoint, rawNeighbourIndex) => {
    const neighbourIndex = closed
      ? (rawNeighbourIndex + n) % n
      : rawNeighbourIndex;
    const neighbour =
      neighbourIndex >= 0 &&
      neighbourIndex <= n - 1 &&
      neighbourIndex !== iA &&
      neighbourIndex !== iB
        ? points[neighbourIndex]
        : null;
    if (neighbour) {
      const dAdj = sub(endPoint, neighbour);
      if (!isDegenerate(dAdj)) {
        const hit = lineIntersection(neighbour, dAdj, onNewLine, dSeg);
        if (hit) return { index: endIndex, ...hit };
      }
    }
    // Open-chain end, collinear joint or degenerate edge → rigid translation.
    return { index: endIndex, ...add(endPoint, delta) };
  };

  return [slideEndpoint(iA, A, iA - 1), slideEndpoint(iB, B, iB + 1)];
}

// Drag vertex `pointIndex` to `targetPos` (pixels).
//
// anglesLocked=false → only the vertex moves (the caller's regular drag).
// anglesLocked=true  → each neighbour slides along its OTHER edge's line so
//                      the edges around the dragged vertex keep their
//                      directions (rectangle-corner behaviour). A neighbour
//                      with no other edge (open-chain end) translates rigidly.
//
// Returns [{ index, x, y }] — always includes the dragged vertex first.
export function computeVertexDragMoves({
  points,
  closed = false,
  pointIndex,
  targetPos,
  anglesLocked = true,
}) {
  const n = points?.length ?? 0;
  if (n < 1 || pointIndex < 0 || pointIndex > n - 1) return [];
  if (!Number.isFinite(targetPos?.x) || !Number.isFinite(targetPos?.y))
    return [];

  const V = points[pointIndex];
  if (!V) return [];
  const moves = [{ index: pointIndex, x: targetPos.x, y: targetPos.y }];
  if (!anglesLocked || n < 3) return moves;

  const delta = sub(targetPos, V);

  const wrap = (i) => (closed ? (i + n) % n : i);
  const exists = (i) => {
    const j = wrap(i);
    return j >= 0 && j <= n - 1;
  };

  for (const dir of [-1, 1]) {
    if (!exists(pointIndex + dir)) continue;
    const uIndex = wrap(pointIndex + dir);
    const U = points[uIndex];
    if (!U || uIndex === pointIndex) continue;

    const dVU = sub(U, V); // direction of the edge around the dragged vertex
    const wIndex = exists(pointIndex + 2 * dir)
      ? wrap(pointIndex + 2 * dir)
      : -1;
    const W = wIndex >= 0 && wIndex !== pointIndex ? points[wIndex] : null;

    let next = null;
    if (W && !isDegenerate(dVU)) {
      const dWU = sub(U, W); // direction of the neighbour's other edge
      if (!isDegenerate(dWU)) {
        next = lineIntersection(targetPos, dVU, W, dWU);
      }
    }
    // No other edge (chain end), parallel or degenerate → rigid translation
    // keeps both the edge direction and the joint angle at the dragged vertex.
    if (!next) next = add(U, delta);
    moves.push({ index: uIndex, x: next.x, y: next.y });
  }

  return moves;
}
