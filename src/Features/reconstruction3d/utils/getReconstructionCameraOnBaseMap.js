import { MathUtils, Matrix4, Vector3 } from "three";

import getBaseMapRenderScale, {
  getBaseMapReferenceSize,
  getGlbModelUnitsPerPx,
} from "Features/baseMaps/js/getBaseMapRenderScale";

// Camera of a 3D reconstruction expressed on its base map, WITHOUT the 3D
// editor (2D editors, 3D model not loaded yet).
//
// A reconstruction camera lives in the glTF frame of the model (Y up). The
// model hangs under the base map group (attachScene3dGlbToBaseMapGroup):
//   scanWrap (scale) → pivot (Rz(−θ)) → inner (−cx, −cy, −zMin + offsetZ)
//     → model root (Rx(+π/2): glTF → scan frame)
// so glTF → base-map-local (x, y in the plane, z the normal, render units —
// the frame of pixelToWorld) is S · Rz(−θ) · T · Rx(+π/2).

// How far ahead of the camera the target is put when its line of sight
// meets nothing (model units).
const DEFAULT_REACH = 2;

const GLTF_TO_SCAN = new Matrix4().makeRotationX(Math.PI / 2);

// glTF frame of the model → base-map-local frame. null without a model.
export function getReconstructionModelToBaseMapMatrix(baseMap) {
  const scene3d = baseMap?.scene3d;
  const zone = scene3d?.zone;
  if (!zone?.center) return null;

  let scale = 1;
  if (scene3d.relativeToBaseMap) {
    const modelUnitsPerPx = getGlbModelUnitsPerPx(baseMap);
    const renderScale = getBaseMapRenderScale(baseMap);
    if (!modelUnitsPerPx || !(renderScale > 0)) return null;
    scale = renderScale / modelUnitsPerPx;
  }

  const matrix = new Matrix4().makeScale(scale, scale, scale);
  matrix.multiply(
    new Matrix4().makeRotationZ(MathUtils.degToRad(-(zone.rotationDeg || 0)))
  );
  matrix.multiply(
    new Matrix4().makeTranslation(
      -zone.center[0],
      -zone.center[1],
      -(zone.zMin ?? scene3d.bbox?.min?.[2] ?? 0) +
        (Number(scene3d.offsetZ) || 0)
    )
  );
  return matrix.multiply(GLTF_TO_SCAN);
}

// Base-map-local point → stored px of the base map (inverse of pixelToWorld)
// + its height above the plane. null without size / scale.
export function baseMapLocalToImagePx(local, baseMap) {
  const size = getBaseMapReferenceSize(baseMap);
  const scale = getBaseMapRenderScale(baseMap);
  if (!(size?.width > 0 && size?.height > 0) || !(scale > 0)) return null;
  const x = size.width / 2 + local.x / scale;
  const y = size.height / 2 - local.y / scale;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, z: local.z, imageSize: size };
}

/**
 * @param {Object} baseMap the reconstruction base map
 * @param {{position: number[], forward: number[]}} pose glTF frame
 * @returns {{
 *   position: {x, y, z},   camera, stored px + height above the plane
 *   headingDeg: number|null, direction in the image (0 = +x, clockwise on
 *     screen: y down); null when the camera looks along the normal
 *   target: {x, y, z},     where the line of sight meets the PLANE of the
 *     base map — or a point a short reach ahead when it never does
 *   targetOnPlane: boolean
 * } | null}
 */
export default function getReconstructionCameraOnBaseMap(baseMap, pose) {
  if (!pose?.position || !pose?.forward) return null;
  const matrix = getReconstructionModelToBaseMapMatrix(baseMap);
  if (!matrix) return null;

  const origin = new Vector3().fromArray(pose.position).applyMatrix4(matrix);
  const direction = new Vector3()
    .fromArray(pose.forward)
    .transformDirection(matrix);
  const position = baseMapLocalToImagePx(origin, baseMap);
  if (!position) return null;

  // image frame: y down
  const planar = Math.hypot(direction.x, direction.y);
  const headingDeg =
    planar > 1e-6
      ? MathUtils.radToDeg(Math.atan2(-direction.y, direction.x))
      : null;

  let targetOnPlane = false;
  let reach = DEFAULT_REACH * matrix.getMaxScaleOnAxis();
  if (direction.z < -1e-6 && origin.z > 0) {
    reach = -origin.z / direction.z;
    targetOnPlane = true;
  }
  const targetLocal = origin.clone().addScaledVector(direction, reach);
  if (targetOnPlane) targetLocal.z = 0;
  const target = baseMapLocalToImagePx(targetLocal, baseMap);
  if (!target) return null;

  return {
    position: { x: position.x, y: position.y, z: position.z },
    headingDeg,
    target: { x: target.x, y: target.y, z: target.z },
    targetOnPlane,
  };
}
