// Signed offset of a typed (locked) rectangle side: the typed value gives the
// LENGTH, the cursor gives the SIDE of the anchor the rectangle grows on.
//
// forced: typed value (may carry a sign); cursorDelta: the cursor's own
// signed offset along the same axis; eps: under it the cursor sits on the
// axis and has no side — the typed sign is kept as a fallback.
export default function applyCursorSide(forced, cursorDelta, eps) {
  if (!Number.isFinite(cursorDelta) || Math.abs(cursorDelta) < eps)
    return forced;
  return Math.sign(cursorDelta) * Math.abs(forced);
}
