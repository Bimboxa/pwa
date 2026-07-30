/**
 * Locate the "solid" fill Mesh inside an annotation Object3D.
 *
 * extrudeClosedShape (and the other builders) return a Group containing the
 * fill Mesh plus decoration children (edge LineSegments, white iso Lines).
 * The fill mesh is tagged `userData.role === "SOLID"`; when absent (older
 * builders), fall back to the first Mesh found in the tree.
 *
 * @param {import("three").Object3D} object
 * @returns {import("three").Mesh|null}
 */
export default function getSolidMeshFromObject3D(object) {
  if (!object) return null;
  if (object.isMesh && object.userData?.role === "SOLID") return object;

  let tagged = null;
  let firstMesh = null;
  object.traverse?.((child) => {
    if (!child.isMesh) return;
    if (!firstMesh) firstMesh = child;
    if (!tagged && child.userData?.role === "SOLID") tagged = child;
  });

  if (object.isMesh && !firstMesh) firstMesh = object;
  return tagged || firstMesh || null;
}

/**
 * All the "solid" fill Meshes inside an annotation Object3D — a builder may
 * emit several (e.g. one lathe Mesh per non-hidden run of a REVOLUTION).
 * Every `role === "SOLID"` mesh is returned; when none is tagged, falls back
 * to the single getSolidMeshFromObject3D result.
 *
 * @param {import("three").Object3D} object
 * @returns {Array<import("three").Mesh>}
 */
export function getSolidMeshesFromObject3D(object) {
  if (!object) return [];
  const tagged = [];
  object.traverse?.((child) => {
    if (child.isMesh && child.userData?.role === "SOLID") tagged.push(child);
  });
  if (tagged.length > 0) return tagged;
  const single = getSolidMeshFromObject3D(object);
  return single ? [single] : [];
}
