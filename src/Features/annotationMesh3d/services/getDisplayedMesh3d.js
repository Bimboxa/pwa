import { getSolidMeshesFromObject3D } from "Features/threedEditor/js/utilsAnnotationsManager/getSolidMeshFromObject3D";

import isAnnotationConvertibleToMesh3d from "../utils/isAnnotationConvertibleToMesh3d";
import convertObject3DToMesh3d from "./convertObject3DToMesh3d";

// One conversion per 3D object AND per solid geometry: a rebuild replaces the
// object, but the live CSG carve (subtractAnnotationGeometries) swaps the
// geometry IN PLACE on the same solid mesh — the entry remembers the
// geometries it was converted from and is redone when they changed.
const cache = new WeakMap();

const getGeometryKey = (solids) =>
  solids.map((mesh) => mesh.geometry?.uuid ?? "").join("|");

// The faces / edges of a REGULAR annotation (not an isMesh3d one yet), read
// from its DISPLAYED 3D object: what lets a face of a plain extrusion be
// selected like a mesh face, without writing anything.
//
//   { mesh, baseMapGroup, baseOffsetZ: 0, object, carved }
//
// Same shape as getEditableMesh3d (worldToMesh3dLocal / mesh3dLocalToWorld
// take it), but synchronous and never rebuilding the object: the mesh is the
// display AS IT IS, shrink included. Its indices only hold while that object
// lives — the part selection is dropped when the geometry changes
// (useMesh3dPartsHighlight), and a write re-locates the parts on the
// un-shrunk conversion (deleteMesh3dPartsService).
//
// Null when the annotation is a mesh already or is not convertible. A flat
// one-face sheet (a one-segment PX wall, a flat polygon: its only face IS
// the annotation) is returned too — the second click selects that face, the
// cut tools lock on it, the vertex offset tool addresses it — unless
// options.allowSingleFace is false: the double-click keeps its plan gesture
// on such sheets.
//
// Open meshes (a PX polyline wall: one zero-thickness quad per segment) are
// accepted here: their faces are selectable like any other, only the writes
// of several open faces (getEditableMesh3d) keep rejecting them.
//
// A CARVED host (a subtraction carved live by the CSG: `hasSubtraction` on
// its solid) is read through the carved-soup conversion (coplanar union per
// plane, buildMesh3dFromCarvedTriangles) — for DISPLAY only: its faces are
// selectable, « Déplacer » moves its point offsets, but no write converts it
// (getEditableMesh3d keeps refusing: « Soustraire définitivement » is the
// way to a mesh). `carved` is returned so the callers gate their writes.
export default function getDisplayedMesh3d(
  editor,
  annotationId,
  { allowSingleFace = true } = {}
) {
  const sceneManager = editor?.sceneManager;
  const annotationsManager = sceneManager?.annotationsManager;
  const object = annotationsManager?.annotationsObjectsMap?.[annotationId];
  if (!object || object.userData?.isAnnotationMesh3d) return null;

  const source = annotationsManager.getAnnotationSource?.(annotationId);
  if (!isAnnotationConvertibleToMesh3d(source)) return null;
  const baseMapGroup = sceneManager.imagesManager?.getGroup?.(source.baseMapId);
  if (!baseMapGroup) return null;

  const solids = getSolidMeshesFromObject3D(object);
  const carved = solids.some((mesh) => mesh.userData?.hasSubtraction);
  const geometryKey = getGeometryKey(solids);
  let entry = cache.get(object);
  if (!entry || entry.geometryKey !== geometryKey) {
    entry = {
      geometryKey,
      mesh: convertObject3DToMesh3d(object, baseMapGroup, {
        allowOpen: true,
        carved,
      }),
    };
    cache.set(object, entry);
  }
  const { mesh } = entry;
  if (!mesh) return null;
  if (mesh.faces.length < 2 && !allowSingleFace) return null;
  return { mesh, baseMapGroup, baseOffsetZ: 0, object, carved };
}

// Geometry fingerprint of a displayed mesh (vertices to the mm + face loops):
// two objects with the same signature number their faces / edges alike.
export function getMesh3dSignature(mesh) {
  if (!mesh) return "";
  const mm = (value) => Math.round(value * 1000);
  const vertices = mesh.vertices
    .map((v) => `${mm(v.x)},${mm(v.y)},${mm(v.z)}`)
    .join(";");
  const faces = mesh.faces
    .map((face) =>
      [face.loop, ...(face.holes || [])].map((loop) => loop.join(",")).join("/")
    )
    .join(";");
  return `${vertices}|${faces}`;
}
