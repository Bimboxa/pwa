// Length axis of a GLB object laid along a path (path array, « Calepinage »):
// the longest HORIZONTAL side of its bounding box — glTF is Y-up, so "x"
// (bbox.width) or "z" (bbox.depth). The object runs along +axis from its
// glTF origin.
export default function getObject3DLengthAxis(object3D) {
  const width = Number(object3D?.bbox?.width) || 0;
  const depth = Number(object3D?.bbox?.depth) || 0;
  return depth > width ? "z" : "x";
}

// How far the object reaches from its glTF origin along its length axis (m).
export function getObject3DLengthFromOrigin(object3D) {
  const axis = getObject3DLengthAxis(object3D);
  const max = Number(object3D?.bbox?.max?.[axis]);
  if (Number.isFinite(max) && max > 0) return max;
  const size = axis === "x" ? object3D?.bbox?.width : object3D?.bbox?.depth;
  return Number(size) > 0 ? Number(size) : null;
}
