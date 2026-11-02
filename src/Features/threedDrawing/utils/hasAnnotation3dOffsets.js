const EPS_M = 1e-6;

const isLifted = (value) => Math.abs(Number(value) || 0) > EPS_M;

const ringHasOffsets = (ring) =>
  (ring || []).some((p) => isLifted(p?.offsetBottom) || isLifted(p?.offsetTop));

// Whether an annotation lives off its base map plane: an `offsetZ`, or a
// per-vertex `offsetBottom` / `offsetTop` on its contour or on a cut. The
// clone flow re-encodes such annotations through the 3D drawing pipeline
// (useCloneAnnotation3d); a flat one keeps the plain 2D clone.
export default function hasAnnotation3dOffsets(annotation) {
  if (!annotation) return false;
  if (isLifted(annotation.offsetZ)) return true;
  if (ringHasOffsets(annotation.points)) return true;
  return (annotation.cuts || []).some((cut) => ringHasOffsets(cut?.points));
}
