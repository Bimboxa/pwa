// Single source of truth for a baseMap's 3D placement.
//
// The 3D placement is parameterized as:
//   - orientation: "HORIZONTAL" (lay flat as a floor) | "VERTICAL" (stand up as a wall)
//   - angleDeg:    rotation around the scene's vertical axis (Three.js +Y)
//   - position:    {x, y, z} translation in Three.js coords
//
// Defaults match the historical render-time fallbacks in the 3D editor so
// existing baseMaps without these fields keep their previous visual.
const DEFAULT_ORIENTATION = "HORIZONTAL";
const DEFAULT_ANGLE_DEG = 0;
const DEFAULT_POSITION = { x: 0, y: 0, z: 0 };

// Three.js Euler order used for the basemap group rotation. With this order,
// `group.rotation.y` is the rotation around world Y (the scene's vertical
// axis), which matches what the gizmo's Y-only ring rotates.
export const BASE_MAP_ROTATION_ORDER = "YXZ";

export default function getBaseMapTransform(baseMap) {
  const orientation = baseMap?.orientation ?? DEFAULT_ORIENTATION;
  const angleDeg = Number.isFinite(baseMap?.angleDeg)
    ? baseMap.angleDeg
    : DEFAULT_ANGLE_DEG;
  const p = baseMap?.position ?? DEFAULT_POSITION;
  return {
    orientation,
    angleDeg,
    position: { x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0 },
  };
}

// Convert (orientation, angleDeg) to a Three.js Euler triple.
// - HORIZONTAL: lay flat on world Y=0 plane, with `angleDeg` rotation around world Y.
// - VERTICAL:   stand up vertical, facing +Z, with `angleDeg` rotation around world Y.
// The result MUST be applied with rotation order BASE_MAP_ROTATION_ORDER on
// the consumer (group.rotation.order = "YXZ"); otherwise the angle around
// world Y won't decompose cleanly.
export function getBaseMapEuler({ orientation, angleDeg }) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const xRad = orientation === "VERTICAL" ? 0 : -Math.PI / 2;
  return { x: xRad, y: angleRad, z: 0 };
}

export {
  DEFAULT_ORIENTATION,
  DEFAULT_ANGLE_DEG,
  DEFAULT_POSITION,
};
