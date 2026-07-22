import { Matrix3, Vector3 } from "three";

import coalesceCoplanarFaces from "./coalesceCoplanarFaces.js";
import extractRegionBoundaryLoops from "./extractRegionBoundaryLoops.js";
import splitTrisIntoComponents from "./splitTrisIntoComponents.js";

// three.js adapter over the pure boundary extraction: converts the coplanar
// region of a hit mesh (tris from faceHoverHighlight.getFaceRegion) into
// maille faces [{contour, holes, normal}] in WORLD coordinates.
//
// The region may hold several edge-connected components (plane-mode regions on
// CSG-carved geometries fragment along T-junction seams): loops are extracted
// per component, then coalesceCoplanarFaces dissolves the seams in a 2D union
// — one face per truly disjoint island, holes preserved.
export default function buildFacesFromRegion(mesh, tris) {
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute("position");
  if (!position || !tris?.length) return null;

  const index = geometry.getIndex();
  const indexArray = index ? index.array : null;

  mesh.updateWorldMatrix(true, false);
  const matrixWorld = mesh.matrixWorld;
  const normalMatrix = new Matrix3().getNormalMatrix(matrixWorld);

  const toWorld = (p) => {
    const v = new Vector3(p.x, p.y, p.z).applyMatrix4(matrixWorld);
    return { x: v.x, y: v.y, z: v.z };
  };

  const worldFaces = [];
  for (const componentTris of splitTrisIntoComponents({
    positions: position.array,
    index: indexArray,
    tris,
  })) {
    const local = extractRegionBoundaryLoops({
      positions: position.array,
      index: indexArray,
      tris: componentTris,
    });
    if (!local) continue;

    const n = new Vector3(local.normal.x, local.normal.y, local.normal.z)
      .applyMatrix3(normalMatrix)
      .normalize();

    worldFaces.push({
      contour: local.contour.map(toWorld),
      holes: local.holes.map((hole) => hole.map(toWorld)),
      normal: { x: n.x, y: n.y, z: n.z },
    });
  }
  if (!worldFaces.length) return null;

  return worldFaces.length > 1 ? coalesceCoplanarFaces(worldFaces) : worldFaces;
}
