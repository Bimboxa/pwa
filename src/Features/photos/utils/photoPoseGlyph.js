// SVG path helpers for the photo camera-pose glyph (2D map): a view cone
// (circular sector) opened from the photo point along the camera direction.
//
// Frame conventions: directionDeg is expressed in the plan LOCAL metre frame
// (y up, CCW positive — same as the revolution axis, computed at commit as
// atan2(-dy, dx)); the returned path is in SVG pixel space (y down), hence
// the minus signs on the y components.

// Point on the circle of radius r around `center`, at angle `deg` (local frame).
function polar(center, r, deg) {
  const t = (deg * Math.PI) / 180;
  return {
    x: center.x + r * Math.cos(t),
    y: center.y - r * Math.sin(t),
  };
}

// Closed sector path: center -> arc from (direction - fov/2) to
// (direction + fov/2) at radius r -> back to center.
export function fovConePath(center, directionDeg, fovDeg, radiusPx) {
  if (!center || !Number.isFinite(radiusPx) || radiusPx <= 0) return "";
  const fov = Number.isFinite(fovDeg) && fovDeg > 0 ? fovDeg : 60;
  const from = polar(center, radiusPx, directionDeg - fov / 2);
  const to = polar(center, radiusPx, directionDeg + fov / 2);
  const largeArc = fov > 180 ? 1 : 0;
  // Local CCW (from -> to through the direction) is CW in the y-down SVG
  // frame -> sweep flag 0.
  return [
    `M ${center.x} ${center.y}`,
    `L ${from.x} ${from.y}`,
    `A ${radiusPx} ${radiusPx} 0 ${largeArc} 0 ${to.x} ${to.y}`,
    "Z",
  ].join(" ");
}

// Middle ray of the cone (direction indicator).
export function fovDirectionLine(center, directionDeg, radiusPx) {
  const end = polar(center, radiusPx, directionDeg);
  return { x1: center.x, y1: center.y, x2: end.x, y2: end.y };
}
