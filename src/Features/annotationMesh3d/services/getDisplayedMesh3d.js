import isAnnotationConvertibleToMesh3d from "../utils/isAnnotationConvertibleToMesh3d";
import convertObject3DToMesh3d from "./convertObject3DToMesh3d";

// One conversion per 3D object: a rebuild replaces the object, so the cache
// follows the displayed geometry on its own.
const cache = new WeakMap();

// The faces / edges of a REGULAR annotation (not an isMesh3d one yet), read
// from its DISPLAYED 3D object: what lets a face of a plain extrusion be
// selected like a mesh face, without writing anything.
//
//   { mesh, baseMapGroup, baseOffsetZ: 0, object }
//
// Same shape as getEditableMesh3d (worldToMesh3dLocal / mesh3dLocalToWorld
// take it), but synchronous and never rebuilding the object: the mesh is the
// display AS IT IS, shrink included. Its indices only hold while that object
// lives — the part selection is dropped when the geometry changes
// (useMesh3dPartsHighlight), and a write re-locates the parts on the
// un-shrunk conversion (deleteMesh3dPartsService).
//
// Null when the annotation is a mesh already, is not convertible, or is a
// flat one-face sheet (its only face IS the annotation).
export default function getDisplayedMesh3d(editor, annotationId) {
  const sceneManager = editor?.sceneManager;
  const annotationsManager = sceneManager?.annotationsManager;
  const object = annotationsManager?.annotationsObjectsMap?.[annotationId];
  if (!object || object.userData?.isAnnotationMesh3d) return null;

  const source = annotationsManager.getAnnotationSource?.(annotationId);
  if (!isAnnotationConvertibleToMesh3d(source)) return null;
  const baseMapGroup = sceneManager.imagesManager?.getGroup?.(source.baseMapId);
  if (!baseMapGroup) return null;

  let mesh = cache.get(object);
  if (mesh === undefined) {
    mesh = convertObject3DToMesh3d(object, baseMapGroup);
    if (mesh && mesh.faces.length < 2) mesh = null;
    cache.set(object, mesh);
  }
  if (!mesh) return null;
  return { mesh, baseMapGroup, baseOffsetZ: 0, object };
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
