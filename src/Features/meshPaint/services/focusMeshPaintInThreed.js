import { Box3, Matrix3, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants";
import { getMeshPaintObject } from "../js/meshPaintObjectsStore";

// Frames a painted part in the 3D viewer (template detail list → « Parties
// peintes » row click, via requestMeshPaintFocus + ThreedMeshPaints). The
// object must be displayed (meshPaintObjectsStore): ThreedMeshPaints keeps a
// highlighted paint displayed even when its own visibility is HIDDEN.
//   - FACE: face-on, camera on the PAINTED side (fitToBox3Facing, side 1 =
//     along the world normal of the painted side).
//   - EDGE: plain fit of its box.
// Resolves true when the camera moved, false when the part is not displayed
// (base map not loaded, row gone…) or the editor is not ready.
export default async function focusMeshPaintInThreed(id) {
  const editor = getActiveThreedEditor();
  const object = getMeshPaintObject(id);
  if (!editor?.fitToBox3Facing || !object) return false;

  object.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(object);
  if (box.isEmpty() || !Number.isFinite(box.min.x)) return false;

  const { partType, localNormal } = object.userData ?? {};
  if (partType === MESH_PAINT_PART_TYPES.FACE && localNormal) {
    const worldNormal = new Vector3(localNormal.x, localNormal.y, localNormal.z)
      .applyMatrix3(new Matrix3().getNormalMatrix(object.matrixWorld))
      .normalize();
    if (worldNormal.lengthSq() > 0) {
      await editor.fitToBox3Facing(box, worldNormal, 1);
      return true;
    }
  }
  // No normal: fitToBox3Facing falls back to a plain fitToBox3.
  await editor.fitToBox3Facing(box, null);
  return true;
}
