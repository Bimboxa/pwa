// Per-triangle face labels of a built annotation geometry
// (geometry.userData.triParts, written by extrudeClosedShape /
// extrudePolylineWall from the break points — see getBreakSegmentLabels):
// two triangles with different labels belong to two faces, even coplanar.
// Null when the geometry carries none (or when the array no longer matches
// the triangles, e.g. a geometry rebuilt by a CSG carve).
export default function getTriangleFaceLabels(geometry) {
  const labels = geometry?.userData?.triParts;
  if (!labels?.length) return null;
  const position = geometry.getAttribute?.("position");
  const index = geometry.getIndex?.();
  const count = index ? index.count : (position?.count ?? 0);
  return labels.length === Math.floor(count / 3) ? labels : null;
}
