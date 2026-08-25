import { EdgesGeometry } from "three";

// Applies the "Wireframe" 3D view settings to every grid-edge line
// (userData.isGridEdge, tagged by the mesh builders and by the carve rebuild
// in subtractAnnotationGeometries) found under `root`.
//
// - `visible` toggles the lines.
// - `thresholdDeg` rebuilds the EdgesGeometry of "EDGES" kind lines from
//   their source mesh geometry (userData.sourceMesh set by the builders, or
//   the parent mesh for carve-rebuilt lines) when it differs from the applied
//   one. "WALL_PLANAR" lines keep their coalesced planar extraction (they
//   already suppress construction seams) — visibility only.
//
// Rebuild is skipped while hidden: toggling back to visible re-applies the
// current threshold (callers always pass the full settings), so the lazy
// rebuild happens then.
export default function applyWireframeSettings(
  root,
  { visible = true, thresholdDeg = 1 } = {}
) {
  root?.traverse?.((child) => {
    if (!child.userData?.isGridEdge) return;
    child.visible = visible;
    if (!visible) return;
    if (child.userData.gridEdgeKind !== "EDGES") return;
    const sourceGeom =
      child.userData.sourceMesh?.geometry ??
      (child.parent?.isMesh ? child.parent.geometry : null);
    const applied = child.userData.appliedThresholdDeg ?? 1;
    if (!sourceGeom || applied === thresholdDeg) return;
    child.geometry.dispose();
    child.geometry = new EdgesGeometry(sourceGeom, thresholdDeg);
    child.userData.appliedThresholdDeg = thresholdDeg;
  });
}
