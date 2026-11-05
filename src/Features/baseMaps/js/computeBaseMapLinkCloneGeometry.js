import baseMapNormalizedToWorld from "./baseMapNormalizedToWorld";

// Pure geometry of a BASE_MAP_LINK section mark located on a VERTICAL base
// map WITHOUT recalibrating that base map ("Adapter l'échelle" off).
//
// In that mode the first clicked point is the anchor and the second one only
// gives the direction: the located segment is redrawn horizontal, at the true
// length of the section mark expressed at the base map's own scale.

const EPS = 1e-9;

// Horizontal world length (m) of a section mark drawn on a plan.
// `planNorm` = { p1, p2 }, normalized {x, y} (same space as `db.points`).
// Returns null when the plan has no usable size / scale or the mark is
// degenerate.
export function getBaseMapLinkWorldLength({ planBaseMap, planNorm }) {
  if (!planBaseMap || !planNorm?.p1 || !planNorm?.p2) return null;
  const A = baseMapNormalizedToWorld(planNorm.p1, planBaseMap);
  const B = baseMapNormalizedToWorld(planNorm.p2, planBaseMap);
  if (!A || !B) return null;
  const length = Math.hypot(B.x - A.x, B.z - A.z);
  return length > EPS ? length : null;
}

// Side of the located segment: +1 when the direction point sits on the right
// of the anchor (or exactly above / below it), -1 on its left.
export function getKeepScaleSide({ anchorPx, directionPx }) {
  return (directionPx?.x ?? 0) >= (anchorPx?.x ?? 0) ? 1 : -1;
}

// Endpoints (image px) of a located section mark that keeps the base map
// scale. The observer side is never changed, so the anchor pins the START of
// the mark (p1, seen on the left) when the segment runs to the right, and
// its END (p2, seen on the right) when it runs to the left.
//
// Returns `{ anchorPx, farPx, side }`, or null when the inputs are unusable.
export function computeKeepScaleClonePoints({
  anchorPx,
  directionPx,
  lengthM,
  meterByPx,
}) {
  if (!anchorPx || !directionPx) return null;
  if (!(lengthM > 0) || !(meterByPx > 0)) return null;
  const side = getKeepScaleSide({ anchorPx, directionPx });
  return {
    anchorPx: { x: anchorPx.x, y: anchorPx.y },
    farPx: { x: anchorPx.x + (side * lengthM) / meterByPx, y: anchorPx.y },
    side,
  };
}
