// Clipping-plane awareness for 3D picking (raycast hits, vertices, lasso).
//
// When the clipping plane is active, geometry on the hidden side must not be
// pickable and must not shadow visible geometry behind it. A world point is
// visible when `plane.distanceToPoint(point) >= 0` (THREE clips the negative
// side); see computePlaneSectionSegments.js for the same convention.

// Small negative tolerance so points lying exactly on the plane stay pickable
// (avoids edge flicker right at the cut).
const CLIP_EPS = -1e-4;

// Returns the active clipping, or null when nothing clips:
//   - the global THREE.Plane alone, or
//   - a "clip set" when base maps are used as clipping planes (« Plan de
//     coupe » of a base map, ClippingManager.setBaseMapClips): the global
//     plane (if enabled) + the slab planes. It answers `distanceToPoint`
//     like a plane (smallest signed distance: negative = clipped by at least
//     one plane), so the callers treat both the same way.
export function getActiveClippingPlane(sceneManager) {
  const cm = sceneManager?.clippingManager;
  const globalPlane = cm?.enabled && cm.plane ? cm.plane : null;
  const clipPlanes = cm?.getBaseMapClipPlanes?.() ?? [];
  if (!clipPlanes.length) return globalPlane;
  const planes = globalPlane ? [globalPlane, ...clipPlanes] : clipPlanes;
  return {
    isClipSet: true,
    globalPlane,
    planes,
    distanceToPoint(point) {
      let min = Infinity;
      for (const plane of planes) {
        const d = plane.distanceToPoint(point);
        if (d < min) min = d;
      }
      return min;
    },
  };
}

// The base map slabs clip the annotations and the point clouds only: the
// content of a base map itself (image plane, GLB scene, scan carrier) stays
// whole, and so stays pickable. The Zmap of a scan base map is NOT part of
// it: that relief mesh stands for the point cloud (it answers the raycasts
// the cloud cannot), so it is cut like the cloud — a hit on the relief of
// points that are not displayed must not be picked.
function isBaseMapOwnContent(object) {
  for (let o = object; o?.parent; o = o.parent) {
    const group = o.parent;
    if (group.userData?.kind !== "baseMap") continue;
    const { meshWrap, scanWrap, localScanWrap } = group.userData;
    return (
      o === meshWrap ||
      o === scanWrap ||
      o === localScanWrap ||
      (Boolean(o.userData?.isDecor) &&
        o.userData?.kind !== "baseMapLocalScanZMap")
    );
  }
  return false;
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
  if (!plane.isClipSet)
    return intersects.filter((i) => isWorldPointVisible(plane, i.point));
  return intersects.filter((i) =>
    isWorldPointVisible(
      isBaseMapOwnContent(i.object) && !i.object?.isPoints
        ? plane.globalPlane
        : plane,
      i.point
    )
  );
}
