import { EdgesGeometry } from "three";

import { buildWallEdges } from "./extrudePolylineWall";

// Applies the "Wireframe" 3D view settings to every grid-edge line
// (userData.isGridEdge, tagged by the mesh builders and by the carve rebuild
// in subtractAnnotationGeometries) found under `root`.
//
// - `visible` toggles the lines.
// - `thresholdDeg` rebuilds the geometry of "EDGES" kind lines from their
//   source mesh geometry (userData.sourceMesh set by the builders and the
//   carve rebuild, or the parent mesh) when it differs from the applied one.
//   CSG-carved meshes (userData.hasSubtraction) are triangle soups with
//   T-junctions, so their lines go through the coplanar-face extraction of
//   buildWallEdges instead of a raw EdgesGeometry (which would slash
//   diagonals across flat faces). "WALL_PLANAR" lines keep their coalesced
//   planar extraction (they already suppress construction seams) —
//   visibility only.
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
    const sourceMesh =
      child.userData.sourceMesh ?? (child.parent?.isMesh ? child.parent : null);
    const sourceGeom = sourceMesh?.geometry;
    const applied = child.userData.appliedThresholdDeg ?? 1;
    if (!sourceGeom || applied === thresholdDeg) return;
    child.geometry.dispose();
    if (sourceMesh.userData?.hasSubtraction) {
      const rebuilt = buildWallEdges(sourceGeom, {
        seamDihedralDeg: thresholdDeg,
        kind: "EDGES",
        material: child.material,
      });
      child.geometry = rebuilt.geometry;
    } else {
      child.geometry = new EdgesGeometry(sourceGeom, thresholdDeg);
    }
    child.userData.appliedThresholdDeg = thresholdDeg;
  });
}
