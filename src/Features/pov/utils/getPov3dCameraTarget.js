import getCaptureRectBounds from "Features/mapEditor/utils/getCaptureRectBounds";

// Target 3D camera pose of a POV against the CURRENT capture frame.
//
// The stored fov is only meaningful together with the frame fraction it was
// saved with. Same content inside the frame on any screen: the frame's angular
// height must match the saved one — tan(fov'/2) * f' = tan(fov/2) * f.
//
// Shared by restorePovViewService (single jump) and the video generator
// (per-frame interpolation), so both land on the exact same framing.
export default function getPov3dCameraTarget({
  camera3d,
  aspectRatio,
  rightInset = 0,
}) {
  if (!camera3d?.position) return null;

  const host = document.querySelector('[data-image-capture-host="THREED"]');
  if (!host) return null;

  const hostBounds = host.getBoundingClientRect();
  const rect = getCaptureRectBounds(
    hostBounds.width,
    hostBounds.height,
    aspectRatio,
    { rightInset }
  );
  const frameFractionNow = hostBounds.height
    ? rect.height / hostBounds.height
    : 1;

  const savedFraction = camera3d.frameFraction || 1;
  const savedFovRad = ((camera3d.fovDeg || 50) * Math.PI) / 180;
  const fovDeg =
    (2 *
      Math.atan(
        (Math.tan(savedFovRad / 2) * savedFraction) / frameFractionNow
      ) *
      180) /
    Math.PI;

  return { position: camera3d.position, target: camera3d.target, fovDeg };
}
