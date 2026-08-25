// Expand a list of typed segment lengths into the points they place.
//
// Dependency free ({x, y} plain objects) so it can be replayed in node.
//
// The direction comes from the cursor (`lastPointPx → directionPointPx`, already
// ortho-snapped by the caller); the distances come from the typed list. This is
// `applyFixedLengthConstraint` applied cumulatively — same radial-rescale model,
// so the angle is preserved and the two compose identically.
//
// Returns one point per length, cumulated from `lastPointPx` (which is NOT
// included). Empty array when there is nothing usable to place.
export default function expandConstraintLengths({
  lastPointPx,
  directionPointPx,
  lengths,
  meterPerPixel,
}) {
  if (!lastPointPx || !directionPointPx) return [];
  if (!Array.isArray(lengths) || lengths.length === 0) return [];
  if (!Number.isFinite(meterPerPixel) || meterPerPixel <= 0) return [];

  const dx = directionPointPx.x - lastPointPx.x;
  const dy = directionPointPx.y - lastPointPx.y;
  const dist = Math.hypot(dx, dy);

  // Cursor sitting on the last point: no direction to read. Fall back to +X,
  // matching applyFixedLengthConstraint's own degenerate case.
  const ux = dist > 1e-6 ? dx / dist : 1;
  const uy = dist > 1e-6 ? dy / dist : 0;

  const points = [];
  let cumulatedPx = 0;
  for (const length of lengths) {
    const value = Number(length);
    if (!Number.isFinite(value) || value <= 0) return [];
    cumulatedPx += value / meterPerPixel;
    points.push({
      x: lastPointPx.x + ux * cumulatedPx,
      y: lastPointPx.y + uy * cumulatedPx,
    });
  }

  return points;
}
