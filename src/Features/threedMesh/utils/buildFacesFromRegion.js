import { Matrix3, Vector3 } from "three";

import extractRegionBoundaryLoops from "./extractRegionBoundaryLoops.js";

// three.js adapter over the pure boundary extraction: converts the coplanar
// region of a hit mesh (tris from faceHoverHighlight.getCoplanarRegion) into
// maille faces [{contour, holes, normal}] in WORLD coordinates.
export default function buildFacesFromRegion(mesh, tris) {
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute("position");
  if (!position || !tris?.length) return null;

  const index = geometry.getIndex();
  const local = extractRegionBoundaryLoops({
    positions: position.array,
    index: index ? index.array : null,
    tris,
  });
  if (!local) return null;

  mesh.updateWorldMatrix(true, false);
  const matrixWorld = mesh.matrixWorld;
  const normalMatrix = new Matrix3().getNormalMatrix(matrixWorld);

  const toWorld = (p) => {
    const v = new Vector3(p.x, p.y, p.z).applyMatrix4(matrixWorld);
    return { x: v.x, y: v.y, z: v.z };
  };

  const n = new Vector3(local.normal.x, local.normal.y, local.normal.z)
    .applyMatrix3(normalMatrix)
    .normalize();

  return [
    {
      contour: local.contour.map(toWorld),
      holes: local.holes.map((hole) => hole.map(toWorld)),
      normal: { x: n.x, y: n.y, z: n.z },
    },
  ];
}
