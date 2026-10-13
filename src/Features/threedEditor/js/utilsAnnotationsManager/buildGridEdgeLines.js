import { EdgesGeometry, LineBasicMaterial, LineSegments } from "three";

// Black grid-edge lines of a built annotation mesh: the EdgesGeometry overlay
// shared by every curved / extruded builder (revolution, dome, inline
// extrusion, swept profile, flat extrusion) and by the surface-cut pieces.
//
// `thresholdDeg` is the EdgesGeometry dihedral threshold the lines are built
// with — the builders receive the current "Wireframe" threshold through
// options.gridEdgeThresholdDeg (AnnotationsManager.wireframeSettings) so the
// lines come out right the first time; applyWireframeSettings only rebuilds
// them when the applied threshold differs (userData.appliedThresholdDeg).
// 1° (three's default, TESSELLATION_THRESHOLD_DEG) draws every facet seam of
// a lathe / arc; the "crease" default (15°) keeps silhouettes, free borders
// and real folds only.
//
// Tagged isGridEdge / "EDGES" (+ sourceMesh) so the carve pipeline can strip
// and rebuild them from the carved geometry (subtractAnnotationGeometries) and
// the Wireframe settings can re-threshold them. Per-call material by default
// (safe to dispose with the object); `material` is reused as-is when given.
const EDGE_MATERIAL = new LineBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.5,
});

export default function buildGridEdgeLines(
  geometry,
  { thresholdDeg = 1, material, sourceMesh } = {}
) {
  const lines = new LineSegments(
    new EdgesGeometry(geometry, thresholdDeg),
    material ?? EDGE_MATERIAL.clone()
  );
  lines.userData = {
    isGridEdge: true,
    gridEdgeKind: "EDGES",
    // Runtime ref for the threshold rebuild (never serialized: lines are not
    // exported).
    sourceMesh,
    appliedThresholdDeg: thresholdDeg,
  };
  lines.raycast = () => {};
  return lines;
}
