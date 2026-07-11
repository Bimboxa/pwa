import { Raycaster, Vector2 } from "three";

import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import baseMapLocalToWorld from "Features/baseMaps/js/baseMapLocalToWorld";
import baseMapWorldToLocal from "Features/baseMaps/js/baseMapWorldToLocal";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";

// Camera math for the seamless 2D <-> 3D viewer switch.
//
// Shared anchor space: the baseMap's stored-pixel frame (`baseMap.image.imageSize`,
// the frame annotation points are resolved into). In 2D it maps to the SVG world
// via `basePose` alone (`world2d = basePose + basePose.k * px` — the version
// image transform only places the *displayed image*, not the annotations). In 3D
// it is exactly the basemap plane parameterization (`pixelToWorld` + placement).
//
// Top-down pose: camera-controls degenerates at polar angle 0 exactly (lookAt
// forward // up gives an uncontrolled roll), so "vertical" means polar = EPSILON
// (~0.06 deg, visually top-down). With azimuth = the basemap's angleDeg, the
// image renders unrotated on screen, matching the 2D view.

export const TOP_DOWN_POLAR_EPSILON = 0.001; // rad

// Gather everything the sync math needs, or null when an exact camera match is
// not possible (caller then falls back to the plain viewer toggle).
export function getCameraSyncContext({ baseMap, basePose }) {
  if (!baseMap) return null;

  // 3D plane and stored points are both parameterized on the legacy `image`
  // field (see getEditorImageFromBaseMap / pixelToWorld call sites).
  const imageSize = baseMap.image?.imageSize;
  if (!(imageSize?.width > 0) || !(imageSize?.height > 0)) return null;

  const meterByPx = baseMap.meterByPx;
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return null;

  const transform = getBaseMapTransform(baseMap);
  // A VERTICAL basemap (wall) has no top-down 2D-equivalent view.
  if (transform.orientation !== "HORIZONTAL") return null;

  if (
    !Number.isFinite(basePose?.x) ||
    !Number.isFinite(basePose?.y) ||
    !(basePose?.k > 0)
  ) {
    return null;
  }

  return {
    meterByPx,
    imageSize: { width: imageSize.width, height: imageSize.height },
    transform,
    alphaRad: (transform.angleDeg * Math.PI) / 180,
  };
}

function storedPxToWorld3d(px, py, ctx) {
  const local = pixelToWorld(
    { x: px, y: py },
    {
      imageWidth: ctx.imageSize.width,
      imageHeight: ctx.imageSize.height,
      meterByPx: ctx.meterByPx,
    }
  );
  return baseMapLocalToWorld(local, ctx.transform);
}

function tanHalfFov(fovDeg) {
  return Math.tan((fovDeg * Math.PI) / 360);
}

// 2D -> 3D: top-down camera pose showing the baseMap image at the same
// on-screen place and size as the current 2D view.
export function computeThreedPoseFrom2d({
  cameraMatrix,
  viewport2d,
  viewport3d,
  basePose,
  ctx,
  fovDeg,
  maxDistance = 500,
}) {
  const cam = cameraMatrix;
  if (!(cam?.k > 0) || !Number.isFinite(cam.x) || !Number.isFinite(cam.y)) {
    return null;
  }
  if (!(viewport2d?.width > 0) || !(viewport2d?.height > 0)) return null;
  if (!(viewport3d?.width > 0) || !(viewport3d?.height > 0)) return null;
  if (!(fovDeg > 0) || fovDeg >= 180) return null;

  // Stored-pixel point at the 2D screen center.
  const wx = (viewport2d.width / 2 - cam.x) / cam.k;
  const wy = (viewport2d.height / 2 - cam.y) / cam.k;
  const px = (wx - basePose.x) / basePose.k;
  const py = (wy - basePose.y) / basePose.k;

  const target = storedPxToWorld3d(px, py, ctx);

  // One 2D screen px spans cam.k * basePose.k stored px, i.e. this many metres:
  const metersPerScreenPx = ctx.meterByPx / (cam.k * basePose.k);
  // Perspective camera straight down: visible height = 2 * d * tan(fov/2).
  let distance =
    (metersPerScreenPx * viewport3d.height) / (2 * tanHalfFov(fovDeg));
  if (!Number.isFinite(distance)) return null;
  // camera-controls dolly limits (ControlsManager.initControls); the near-
  // ortho entry pose is allowed farther (the caller lifts maxDistance).
  distance = Math.min(maxDistance, Math.max(0.1, distance));

  const eps = TOP_DOWN_POLAR_EPSILON;
  const alpha = ctx.alphaRad;
  return {
    position: {
      x: target.x + distance * Math.sin(eps) * Math.sin(alpha),
      y: target.y + distance * Math.cos(eps),
      z: target.z + distance * Math.sin(eps) * Math.cos(alpha),
    },
    target: { x: target.x, y: target.y, z: target.z },
  };
}

// Metres spanned by one screen pixel, from either side of the switch. Both are
// the invariant the fov dolly-zoom preserves.
export function metersPerScreenPxFrom2d({ cameraMatrix, basePose, ctx }) {
  return ctx.meterByPx / (cameraMatrix.k * basePose.k);
}

export function metersPerScreenPxFrom3d({ distance, fovDeg, viewportHeight }) {
  return (2 * distance * tanHalfFov(fovDeg)) / viewportHeight;
}

// Near-ortho fov for the flat <-> perspective dolly-zoom illusion: as narrow
// as possible (narrow fov + far camera ~ orthographic), but keeping the
// scale-matching camera distance under `maxDistanceM` so the plan stays well
// inside the camera far plane during the transition.
export function computeOrthoFov({
  metersPerScreenPx,
  viewportHeight,
  maxDistanceM = 800,
  minFovDeg = 8,
}) {
  const tanHalf = Math.max(
    Math.tan((minFovDeg * Math.PI) / 360),
    (metersPerScreenPx * viewportHeight) / (2 * maxDistanceM)
  );
  return (Math.atan(tanHalf) * 360) / Math.PI;
}

// 3D -> 2D, step 1: the pivot to animate the camera around — the point of the
// baseMap plane at the 3D screen center (image center when the ray misses or
// lands outside the image).
export function computeTopDownPivotFrom3d({ camera, ctx }) {
  if (!camera) return null;

  let px = ctx.imageSize.width / 2;
  let py = ctx.imageSize.height / 2;

  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(0, 0), camera);
  // Analytic intersection with the (infinite) basemap plane: local z = 0.
  const origin = baseMapWorldToLocal(camera.position, ctx.transform);
  const dir = baseMapWorldToLocal(
    {
      x: camera.position.x + raycaster.ray.direction.x,
      y: camera.position.y + raycaster.ray.direction.y,
      z: camera.position.z + raycaster.ray.direction.z,
    },
    ctx.transform
  ).sub(origin);

  if (Math.abs(dir.z) > 1e-9) {
    const t = -origin.z / dir.z;
    if (t > 0 && Number.isFinite(t)) {
      const hitX = origin.x + t * dir.x;
      const hitY = origin.y + t * dir.y;
      const hitPx = hitX / ctx.meterByPx + ctx.imageSize.width / 2;
      const hitPy = -hitY / ctx.meterByPx + ctx.imageSize.height / 2;
      if (Number.isFinite(hitPx) && Number.isFinite(hitPy)) {
        // A view legitimately centered a bit off the image edge must stay
        // exact, but grazing rays can land absurdly far: clamp with a margin
        // of one image dimension around the rect.
        const mx = ctx.imageSize.width;
        const my = ctx.imageSize.height;
        px = Math.min(ctx.imageSize.width + mx, Math.max(-mx, hitPx));
        py = Math.min(ctx.imageSize.height + my, Math.max(-my, hitPy));
      }
    }
  }

  const target = storedPxToWorld3d(px, py, ctx);
  const distance = Math.hypot(
    camera.position.x - target.x,
    camera.position.y - target.y,
    camera.position.z - target.z
  );
  if (!(distance > 0) || !Number.isFinite(distance)) return null;

  return {
    storedPx: { x: px, y: py },
    target: { x: target.x, y: target.y, z: target.z },
    distance,
  };
}

// 3D -> 2D, step 2: the {x, y, k} camera matrix that shows the image at the
// same place/size as the settled top-down 3D view (pivot at screen center).
export function computeTwodCameraMatrixFromTopDown({
  storedPx,
  distance,
  viewport2d,
  viewport3d,
  basePose,
  ctx,
  fovDeg,
}) {
  if (!(viewport2d?.width > 0) || !(viewport2d?.height > 0)) return null;
  if (!(viewport3d?.height > 0)) return null;
  if (!(distance > 0) || !(fovDeg > 0) || fovDeg >= 180) return null;

  const metersPerScreenPx =
    (2 * distance * tanHalfFov(fovDeg)) / viewport3d.height;
  const k = ctx.meterByPx / (metersPerScreenPx * basePose.k);
  if (!Number.isFinite(k) || k <= 0) return null;

  // 2D world position of the pivot, to be placed at the 2D screen center.
  const wx = basePose.x + basePose.k * storedPx.x;
  const wy = basePose.y + basePose.k * storedPx.y;

  return {
    x: viewport2d.width / 2 - k * wx,
    y: viewport2d.height / 2 - k * wy,
    k,
  };
}
