// "Axes" section of the 3D view settings: colours and defaults of the axes
// display (orientation gizmo + in-scene axes helper), and the yaw of the
// displayed frame.
//
// User-facing convention: Z is vertical (see utils/userCoords.js, which swaps
// Three.js Y and Z). X / Y lie in the horizontal plane. The frame rotation
// rotates the gizmo, the in-scene axes and the gizmo's face views around the
// vertical axis, and orients the 3D drawing helpers: the axis locks, the
// natural drawing planes and the colours / letters of the length badges
// follow this frame (threedDrawing). The model, the camera and the 2D↔3D
// sync are untouched.

export const AXIS_COLORS = {
  X: "#e5484d", // red
  Y: "#46a758", // green
  Z: "#3b82f6", // blue
};

export const DEFAULT_AXES_SETTINGS = {
  showGizmo: true,
  showSceneAxes: false,
  yawDeg: 0,
};

// Finite number wrapped into [0, 360); anything else → 0.
export function normalizeAxesYawDeg(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return ((v % 360) + 360) % 360;
}

export function isAxesSettings(value) {
  return (
    !!value &&
    typeof value === "object" &&
    typeof value.showGizmo === "boolean" &&
    typeof value.showSceneAxes === "boolean" &&
    Number.isFinite(value.yawDeg)
  );
}
