// True when `annotation` cannot be a POLYGON: fewer than 3 point refs.
//
// A vertical face drawn in 3D from a POLYGON template is committed as an OPEN
// 2-point POLYLINE band (commitDrawnFaceService, PERPENDICULAR branch): one
// point per plan position, `offsetZ` + `height` for the vertical span. Typed
// POLYGON (a template change used to do it), the row vanishes in 3D —
// extrudeClosedShape refuses a ring under 3 points — and degenerates in 2D.
//
// isMesh3d rows are exempt: their `points` are the plan projection of a
// stored mesh (a vertical sheet projects onto 2 points) and the 3D builder
// renders the mesh before looking at the ring.
//
// Pure: works on the raw DB row (`points` = `{id}` refs) as well as on the
// resolved annotation. No imports (node-testable).
export default function isDegeneratePolygonRow(annotation) {
  if (!annotation || annotation.isMesh3d) return false;
  const points = annotation.points;
  return Array.isArray(points) && points.length < 3;
}
