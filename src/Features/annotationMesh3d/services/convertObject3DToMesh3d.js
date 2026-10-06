import { Matrix4, Vector3 } from "three";

import { getSolidMeshesFromObject3D } from "Features/threedEditor/js/utilsAnnotationsManager/getSolidMeshFromObject3D";
import { MESH3D_Z_FIGHT_OFFSET } from "Features/threedEditor/js/utilsAnnotationsManager/buildMesh3dAnnotationObject";

import buildMesh3dFromTriangles from "../utils/buildMesh3dFromTriangles";
import { getMesh3dSignedVolume } from "../utils/getMesh3dQties";
import isMesh3dClosed from "../utils/isMesh3dClosed";
import { reverseFace } from "../utils/mesh3dTopology";

// Beyond this the source is a generated shape (sampled arcs...), not something
// to hand-edit face by face.
const MAX_FACES = 2000;

// Freezes the LIVE 3D object of a regular annotation into a face mesh, in
// base-map-local meters. Reading the scene object — not the db row — makes
// the conversion WYSIWYG: template overrides, thick-wall outlines and arc
// sampling are already applied to it.
//
// Returns the LOCAL mesh with ABSOLUTE local z (the annotation's offsetZ is
// baked in the geometry; the caller re-bases it), or null when the solid is
// not convertible: CSG-carved, neither closed nor a single flat face, etc.
//
// options.allowOpen: an OPEN mesh of several faces (the zero-thickness quads
// of a PX polyline wall, a sloped band...) is returned as it is instead of
// null — for a display-only use (face selection, getDisplayedMesh3d), never
// for a write: its winding is not normalized.
export default function convertObject3DToMesh3d(
  object,
  baseMapGroup,
  { allowOpen = false } = {}
) {
  if (!object || !baseMapGroup) return null;
  const solids = getSolidMeshesFromObject3D(object);
  if (!solids.length) return null;
  if (solids.some((mesh) => mesh.userData?.hasSubtraction)) return null;

  baseMapGroup.updateWorldMatrix(true, false);
  const worldToLocal = new Matrix4().copy(baseMapGroup.matrixWorld).invert();

  const positions = [];
  const v = new Vector3();
  const toLocal = new Matrix4();
  for (const mesh of solids) {
    const position = mesh.geometry?.getAttribute("position");
    if (!position) continue;
    const index = mesh.geometry.getIndex();
    mesh.updateWorldMatrix(true, false);
    toLocal.multiplyMatrices(worldToLocal, mesh.matrixWorld);
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(
        toLocal
      );
      // The builders lift their geometry by 1 mm (z-fight): not geometry.
      positions.push(v.x, v.y, v.z - MESH3D_Z_FIGHT_OFFSET);
    }
  }
  if (positions.length < 9) return null;

  const mesh = buildMesh3dFromTriangles({ positions });
  if (!mesh || mesh.faces.length > MAX_FACES) return null;

  if (isMesh3dClosed(mesh)) {
    // Builders do not guarantee outward winding (the pixel → local Y flip).
    return getMesh3dSignedVolume(mesh) < 0
      ? { vertices: mesh.vertices, faces: mesh.faces.map(reverseFace) }
      : mesh;
  }
  // A flat polygon (height 0) is a one-face sheet.
  if (mesh.faces.length === 1 || allowOpen) return mesh;
  return null;
}
