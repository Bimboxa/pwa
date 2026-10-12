import { Raycaster, Vector2 } from "three";

import {
  closestPointOnAxis,
  ndcDistance,
} from "../../threedDrawing/utils/computeSnapTarget.js";

// « Déplacer » with Shift in 3D — the twin of the 2D getOrthoConstrainedPoint
// with one more axis: the destination is locked on the user axis (X / Y / Z
// of the gizmo frame, getUserAxesWorldDirections) through the grabbed point
// that is closest to the cursor on screen. No threshold: Shift always locks,
// the dominant axis wins. Axes parallel to the cursor ray are skipped.
//
// axes: [{ key, dir: Vector3 (unit) }]. Returns { position: Vector3, axis }
// or null.
export default function computeAxisLockSnap({
  mouseNdc,
  camera,
  canvasSize,
  origin,
  axes,
  raycaster = new Raycaster(),
}) {
  if (!camera || !origin || !axes?.length) return null;
  raycaster.setFromCamera(new Vector2(mouseNdc.x, mouseNdc.y), camera);
  const { origin: rayOrigin, direction } = raycaster.ray;

  let best = null;
  for (const axis of axes) {
    const point = closestPointOnAxis(rayOrigin, direction, origin, axis.dir);
    if (!point) continue;
    const { distance, behind } = ndcDistance(
      point,
      mouseNdc,
      camera,
      canvasSize
    );
    if (behind) continue;
    if (!best || distance < best.distance) {
      best = { position: point, axis: axis.key, distance };
    }
  }
  if (!best) return null;
  return { position: best.position, axis: best.axis };
}
