import { Quaternion, Vector3 } from "three";

// World-space normal of the baseMap an annotation belongs to. The annotation
// object is a child of the basemap group, so the parent's world quaternion
// encodes the basemap orientation and the basemap-local +Z axis is its normal.
// For a horizontal basemap this maps to world +Y.
//
// This is the axis annotation heights are extruded along, and the constraint
// axis used by the move gizmo in sub-selection mode (there the user expects
// "up" as they see it, not the per-face normal).
export default function getBaseMapNormalWorld(annoObject) {
  const parent = annoObject?.parent;
  if (!parent) return new Vector3(0, 1, 0);
  const q = parent.getWorldQuaternion(new Quaternion());
  return new Vector3(0, 0, 1).applyQuaternion(q).normalize();
}
