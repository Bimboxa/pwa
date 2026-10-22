import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
} from "three";

import { getSolidMeshesFromObject3D } from "./getSolidMeshFromObject3D";

// Material of a merged solid when the caller gives none (headless CSG
// operands): shared, never disposed.
export const MERGED_SOLID_MATERIAL = new MeshBasicMaterial();

// Every solid mesh of an annotation object, baked to WORLD space, as ONE
// non-indexed Mesh with an identity transform (`userData.role: "SOLID"`).
//
// Why: a mesh3d annotation object is built as one THREE.Mesh per face
// (buildMesh3dAnnotationObject), and a CSG boolean run face by face would
// treat each face as an open sheet — SUBTRACTION closes each one on its own
// (caps per face), and a per-face cutter bounds no volume at all. Merged, the
// faces form the closed solid they describe. Used by the permanent bake
// (bakeAnnotationSubtractionsService) and by subtractAnnotationGeometries for
// a mesh3d host or cutter.
//
// Returns null without triangles. The source meshes are left untouched.
export default function buildMergedWorldSolid(object, { material } = {}) {
  const positions = [];
  for (const mesh of getSolidMeshesFromObject3D(object)) {
    const position = mesh.geometry?.getAttribute("position");
    if (!position) continue;
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    positions.push(...geometry.getAttribute("position").array);
    geometry.dispose();
  }
  if (positions.length < 9) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3)
  );
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, material ?? MERGED_SOLID_MATERIAL);
  mesh.userData = { role: "SOLID" };
  mesh.updateMatrixWorld(true);
  return mesh;
}
