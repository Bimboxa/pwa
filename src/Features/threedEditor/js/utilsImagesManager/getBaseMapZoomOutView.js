// View direction of the Dessin module's 3D "Zoom out" on a base map plane:
// spherical angles (camera-controls Y-up convention) of the center → camera
// direction, derived from the base map placement (getBaseMapTransform).
//
// Convention shared with viewers/utils/viewerCameraSync (getCameraSyncContext):
// azimuth = angleDeg puts the camera on the plane's front face with the image
// upright on screen, exactly like the 2D view. From that head-on pose:
//   - HORIZONTAL (floor plan): instead of the strictly top-down view, the
//     camera is tilted by ZOOM_OUT_HORIZONTAL_TILT_RAD toward the bottom edge
//     of the image, so the relief (walls, extrusions) reads on screen.
//   - VERTICAL (elevation / section): head-on (polar = PI/2), then the camera
//     slides to its right by ZOOM_OUT_VERTICAL_RIGHT_SHIFT_RAD. A growing
//     azimuth moves the camera toward its own right (x = sin(azimuth) in Y-up).
// Both constants are a matter of taste: tune them by eye.

export const ZOOM_OUT_HORIZONTAL_TILT_RAD = (25 * Math.PI) / 180;
export const ZOOM_OUT_VERTICAL_RIGHT_SHIFT_RAD = (20 * Math.PI) / 180;

export default function getBaseMapZoomOutView(transform) {
  const angleDeg = Number.isFinite(transform?.angleDeg)
    ? transform.angleDeg
    : 0;
  const alphaRad = (angleDeg * Math.PI) / 180;

  if (transform?.orientation === "VERTICAL") {
    return {
      azimuthRad: alphaRad + ZOOM_OUT_VERTICAL_RIGHT_SHIFT_RAD,
      polarRad: Math.PI / 2,
    };
  }
  return {
    azimuthRad: alphaRad,
    polarRad: ZOOM_OUT_HORIZONTAL_TILT_RAD,
  };
}
