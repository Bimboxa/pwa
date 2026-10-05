import { Vector3 } from "three";

import {
  HATCH_LINE_WIDTH_PX,
  isPointOnHatchInk,
} from "Features/geometry/utils/getHatchFillGeometry";

// Selection / hover picking of the hatched fills (see applyHatchFill): the
// ray goes through the gaps between the hatch lines, and only the band and
// the lines catch it. Tool pickers do NOT use this filter — the full surface
// of a hatched annotation stays a drawing / placement support.

const PICK_TOLERANCE_PX = 4;

const _local = new Vector3();

// Size of one screen pixel (meters) at the distance of the hit.
function getMetersPerPixel(camera, distance, viewportHeight) {
  if (!viewportHeight) return 0;
  if (camera?.isPerspectiveCamera) {
    const fov = (camera.fov * Math.PI) / 180;
    return (2 * distance * Math.tan(fov / 2)) / camera.zoom / viewportHeight;
  }
  if (camera?.isOrthographicCamera) {
    return (camera.top - camera.bottom) / camera.zoom / viewportHeight;
  }
  return 0;
}

export function isHatchGapHit(intersect, camera, viewportHeight) {
  const object = intersect?.object;
  const hatchPick = object?.userData?.isHatchPickSurface
    ? object.userData.hatchPick
    : null;
  if (!hatchPick) return false;

  object.worldToLocal(_local.copy(intersect.point)).sub(hatchPick.origin);
  const point = { x: _local.dot(hatchPick.u), y: _local.dot(hatchPick.v) };
  const tolerance =
    (PICK_TOLERANCE_PX + HATCH_LINE_WIDTH_PX / 2) *
    getMetersPerPixel(camera, intersect.distance, viewportHeight);
  return !isPointOnHatchInk(point, hatchPick, tolerance);
}

export function filterIntersectionsByHatchGaps(
  intersects,
  camera,
  viewportHeight
) {
  return (intersects || []).filter(
    (i) => !isHatchGapHit(i, camera, viewportHeight)
  );
}
