// Module-level registry of the painted-part objects currently displayed in
// the 3D scene (mirror of mesh3dObjectsStore). ThreedMeshPaints publishes a
// fresh Map after every rebuild pass; the brush picking (existing paints win
// the click) and focusMeshPaintInThreed read it.
//
// Map<meshPaintId, Object3D>. Each object lives under its base map group (a
// `userData.isPaintLayer` Group child of imagesManager.getGroup(baseMapId)),
// in base-map-LOCAL meters, and carries
//   userData: { isPaintOverlay: true, meshPaintId, partType: "FACE" | "EDGE",
//     annotationTemplateId, hostAnnotationId, baseMapId,
//     visibility: "VISIBLE" | "DIMMED" | "HIDDEN" (HIDDEN = shown only
//       because it is highlighted from the panel),
//     status: "OK" | "ORPHAN" | "CONFLICT",
//     localGeometry: LocalFace | LocalEdge (paintGeometryToLocal output),
//     localNormal: {x, y, z} | null (FACE: unit, toward the painted side) }
// and `raycast = () => {}` (invisible to the generic pickers — raycast it
// explicitly with Mesh.prototype.raycast.call). A FACE is a FrontSide Mesh
// whose front faces look toward the painted side; an EDGE is a LineSegments2.
// The parent chain can still be hidden (base map eye): check
// isObjectChainVisible before picking.

const EMPTY = new Map();

let _objects = EMPTY;
const _listeners = new Set();

export function setMeshPaintObjects(objects) {
  _objects = objects instanceof Map ? objects : EMPTY;
  _listeners.forEach((callback) => {
    try {
      callback(_objects);
    } catch (e) {
      console.error("[meshPaintObjectsStore] listener threw", e);
    }
  });
}

export function getMeshPaintObject(id) {
  return (id && _objects.get(id)) || null;
}

export function getMeshPaintObjects() {
  return _objects;
}

// callback(objectsMap) after every publish. Returns the unsubscribe function.
export function subscribeMeshPaintObjects(callback) {
  if (typeof callback !== "function") return () => {};
  _listeners.add(callback);
  return () => _listeners.delete(callback);
}
