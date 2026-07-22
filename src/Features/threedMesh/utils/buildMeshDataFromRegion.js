import { Vector3 } from "three";

import buildShellFromRegion from "./buildShellFromRegion.js";
import coalesceCoplanarFaces from "./coalesceCoplanarFaces.js";
import extractRegionBoundaryLoops from "./extractRegionBoundaryLoops.js";
import isRegionPlanar from "./isRegionPlanar.js";
import splitTrisIntoComponents from "./splitTrisIntoComponents.js";

// three.js adapter over the pure geometry utils: converts the hovered region
// of a mesh (tris from faceHoverHighlight.getFaceRegion) into the data of a
// maille, in WORLD coordinates:
//
// - planar region  → { faces: [{contour, holes, normal}] }, the historical
//   polygon model (cut tools, splits, merges work on it).
// - curved region  → { shell: {positions, boundaries, surface} }, a
//   triangulated surface — what a revolution or a profile swept along a curve
//   needs now that the region grow follows facets (see isRegionPlanar).
//
// A planar region may hold several edge-connected components (plane-mode
// regions on CSG-carved geometries fragment along T-junction seams): loops are
// extracted per component, then coalesceCoplanarFaces dissolves the seams in a
// 2D union — one face per truly disjoint island, holes preserved.

// Region triangles as a standalone world-space soup (9 numbers per triangle,
// no index). Everything downstream welds by position, so dropping the shared
// index costs nothing and keeps the work O(region) instead of O(geometry).
function buildWorldSoup(mesh, tris) {
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute("position");
  if (!position || !tris?.length) return null;

  const index = geometry.getIndex();
  const vertIndex = index
    ? (t, c) => index.getX(3 * t + c)
    : (t, c) => 3 * t + c;

  mesh.updateWorldMatrix(true, false);
  const matrixWorld = mesh.matrixWorld;

  const positions = new Array(9 * tris.length);
  const v = new Vector3();
  let offset = 0;
  for (const t of tris) {
    for (let c = 0; c < 3; c++) {
      v.fromBufferAttribute(position, vertIndex(t, c)).applyMatrix4(
        matrixWorld
      );
      positions[offset++] = v.x;
      positions[offset++] = v.y;
      positions[offset++] = v.z;
    }
  }
  return { positions, tris: tris.map((_, i) => i) };
}

export default function buildMeshDataFromRegion(mesh, tris) {
  const soup = buildWorldSoup(mesh, tris);
  if (!soup) return null;
  const { positions, tris: soupTris } = soup;

  if (!isRegionPlanar({ positions, index: null, tris: soupTris })) {
    const shell = buildShellFromRegion({
      positions,
      index: null,
      tris: soupTris,
    });
    return shell?.boundaries?.length ? { shell } : null;
  }

  const faces = [];
  for (const componentTris of splitTrisIntoComponents({
    positions,
    index: null,
    tris: soupTris,
  })) {
    const loops = extractRegionBoundaryLoops({
      positions,
      index: null,
      tris: componentTris,
    });
    if (loops) faces.push(loops);
  }
  if (!faces.length) return null;

  return { faces: faces.length > 1 ? coalesceCoplanarFaces(faces) : faces };
}
