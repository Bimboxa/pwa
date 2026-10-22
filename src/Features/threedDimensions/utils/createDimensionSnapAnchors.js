import { Object3D } from "three";

// Snap-only anchors of a dimension (COTE / RULER): its MEASURED points, in
// the parent group's local metres (y up, z = altitude). A bare Object3D read
// by useVertexSnap's buildIndex and findBaseMapGroupsAtVertex through
// userData.snapAnchors — no geometry, no raycast, never picked.
// 2D parity (getBestSnap): only the measured points snap, never the offset
// dimension line nor the value card.
// userData.isDimensionSnapAnchors: skipped by the `annotationsOnly` index
// (3D move / rotate grab) — a dimension is not a grabbable annotation there,
// and a cote anchor coinciding with a polyline vertex must not screen it.
export default function createDimensionSnapAnchors(points) {
  const anchors = (points ?? [])
    .filter(
      (p) =>
        Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number.isFinite(p?.z)
    )
    .map((p) => [p.x, p.y, p.z]);
  if (!anchors.length) return null;
  const obj = new Object3D();
  obj.userData.snapAnchors = anchors;
  obj.userData.isDimensionSnapAnchors = true;
  return obj;
}
