// Clipping-plane awareness for 3D picking (raycast hits, vertices, lasso).
//
// When the clipping plane is active, geometry on the hidden side must not be
// pickable and must not shadow visible geometry behind it. A world point is
// visible when `plane.distanceToPoint(point) >= 0` (THREE clips the negative
// side); see computePlaneSectionSegments.js for the same convention.

// Small negative tolerance so points lying exactly on the plane stay pickable
// (avoids edge flicker right at the cut).
const CLIP_EPS = -1e-4;

// Returns the active THREE.Plane, or null when clipping is off / unavailable.
export function getActiveClippingPlane(sceneManager) {
  const cm = sceneManager?.clippingManager;
  if (!cm?.enabled || !cm.plane) return null;
  return cm.plane;
}

// True when the point is on the visible side (or clipping is off / no point).
export function isWorldPointVisible(plane, point) {
  if (!plane || !point) return true;
  return plane.distanceToPoint(point) >= CLIP_EPS;
}

// Drop raycast hits whose hit point is clipped away. `intersects` are already
// sorted near→far, so the first survivor is the correct pick.
export function filterIntersectionsByClipping(intersects, plane) {
  if (!plane) return intersects;
  return intersects.filter((i) => isWorldPointVisible(plane, i.point));
}
