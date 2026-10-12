// Pixel-space affine map of a rotation of `angleDeg` about `pivotPx` (y
// down: a positive angle turns clockwise on screen — the convention of
// applyWrapperTransformToPoints / getTransformPointUpdates):
//   x' = px + (x − px)·cos − (y − py)·sin
//   y' = py + (x − px)·sin + (y − py)·cos
// as { a, b, c, d, e, f } with x' = a·x + b·y + c, y' = d·x + e·y + f — the
// form applyAffineToMesh3d / applyAffineToMesh3dSource consume.
//
// Plain ESM (no path aliases) so the node tests can load it.
export default function getPixelRotationAffine({ pivotPx, angleDeg }) {
  const rad = ((angleDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const px = pivotPx?.x || 0;
  const py = pivotPx?.y || 0;
  return {
    a: cos,
    b: -sin,
    c: px - px * cos + py * sin,
    d: sin,
    e: cos,
    f: py - px * sin - py * cos,
  };
}
