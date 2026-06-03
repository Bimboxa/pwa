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
