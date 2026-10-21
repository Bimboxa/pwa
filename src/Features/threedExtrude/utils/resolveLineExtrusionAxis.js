import computeDraftPlane from "Features/threedDrawing/utils/computeDraftPlane";

// |normal · baseMapNormal| under this: the polyline's plane is vertical, its
// normal has no "up" side to prefer.
const VERTICAL_PLANE_MAX_DOT = 0.1;

// Natural extrusion axis of a flat POLYLINE picked by the « Extruder » tool
// (world space, unit Vector3): the normal of the plane its vertices lie on
// (Newell, computeDraftPlane), signed so that a positive value goes up along
// the base map normal — or toward the camera when that plane is vertical.
// A polyline with no plane (2 points, collinear vertices) extrudes along the
// base map normal.
//
// worldPoints: [Vector3]. baseMapNormal: unit Vector3. cameraPosition /
// anchor: Vector3 (optional, the vertical-plane tie-break).
// Returns { axis: Vector3, fromPlane: boolean }.
export default function resolveLineExtrusionAxis({
  worldPoints,
  baseMapNormal,
  cameraPosition = null,
  anchor = null,
}) {
  const plane = computeDraftPlane(worldPoints);
  if (!plane)
    return { axis: baseMapNormal.clone().normalize(), fromPlane: false };

  const axis = plane.normal.clone().normalize();
  const up = axis.dot(baseMapNormal);
  if (Math.abs(up) >= VERTICAL_PLANE_MAX_DOT) {
    if (up < 0) axis.negate();
  } else if (cameraPosition && anchor) {
    const toCamera = cameraPosition.clone().sub(anchor);
    if (axis.dot(toCamera) < 0) axis.negate();
  }
  return { axis, fromPlane: true };
}
