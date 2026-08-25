// Pure math for editing ONE segment length of a RULER chain.
//
// Dependency free (plain {x, y} objects) so it can be replayed in node.
//
// `points`      resolved pixel points of the ruler, in order
// `segmentIndex` the edited segment: points[segmentIndex] → points[segmentIndex + 1]
// `movedPointIndex` which end of that segment moves (the SELECTED point) —
//                must be segmentIndex or segmentIndex + 1
// `targetPx`    the new segment length, in pixels
// `lockNeighbour` when true, the rest of the chain on the moved point's side
//                is rigidly translated by the same delta, so the neighbouring
//                segment keeps its length; when false only the moved point
//                moves and the neighbour absorbs the difference.
//
// Returns `[{ index, x, y }]` — the points to write, or [] when nothing moves.
export default function computeRulerLengthEdit({
  points,
  segmentIndex,
  movedPointIndex,
  targetPx,
  lockNeighbour = false,
}) {
  const n = points?.length ?? 0;
  if (n < 2) return [];
  if (segmentIndex < 0 || segmentIndex > n - 2) return [];
  if (movedPointIndex !== segmentIndex && movedPointIndex !== segmentIndex + 1)
    return [];
  if (!Number.isFinite(targetPx) || targetPx <= 0) return [];

  // The segment endpoint that stays put is the other end of the edited segment.
  const anchorIndex =
    movedPointIndex === segmentIndex ? segmentIndex + 1 : segmentIndex;
  const anchor = points[anchorIndex];
  const moved = points[movedPointIndex];
  if (!anchor || !moved) return [];

  // Direction anchor → moved, i.e. the segment keeps its orientation and only
  // its length changes.
  const dx = moved.x - anchor.x;
  const dy = moved.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return []; // degenerate segment: no direction to grow along

  const ux = dx / len;
  const uy = dy / len;
  const nextX = anchor.x + ux * targetPx;
  const nextY = anchor.y + uy * targetPx;

  const deltaX = nextX - moved.x;
  const deltaY = nextY - moved.y;
  if (Math.abs(deltaX) < 1e-9 && Math.abs(deltaY) < 1e-9) return [];

  const result = [{ index: movedPointIndex, x: nextX, y: nextY }];
  if (!lockNeighbour) return result;

  // Locked neighbour → translate the whole downstream run rigidly, so every
  // segment beyond the moved point keeps its length AND its direction. The
  // "downstream" side is the one AWAY from the anchor: moving points[i] with
  // the anchor before it drags i+1…n-1; with the anchor after it drags 0…i-1.
  if (movedPointIndex > anchorIndex) {
    for (let i = movedPointIndex + 1; i < n; i++) {
      result.push({
        index: i,
        x: points[i].x + deltaX,
        y: points[i].y + deltaY,
      });
    }
  } else {
    for (let i = movedPointIndex - 1; i >= 0; i--) {
      result.push({
        index: i,
        x: points[i].x + deltaX,
        y: points[i].y + deltaY,
      });
    }
  }

  return result;
}
