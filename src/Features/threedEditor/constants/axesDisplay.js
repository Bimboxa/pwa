// "Axes" section of the 3D view settings: colours and defaults of the axes
// display (orientation gizmo + in-scene axes helper), the yaw and the origin
// of the displayed frame.
//
// User-facing convention: Z is vertical (see utils/userCoords.js, which swaps
// Three.js Y and Z). X / Y lie in the horizontal plane. The frame rotation
// rotates the gizmo, the in-scene axes and the gizmo's face views around the
// vertical axis, and orients the 3D drawing helpers: the axis locks, the
// natural drawing planes, the in-plane ortho / alignment snaps on plans and
// horizontal faces (cross arms of intersectBaseMapPlane / buildFacePlaneHit),
// the rectangle sides, the face cuts and the colours / letters of the length
// badges follow this frame (threedDrawing, threedFaceCut, move / rotate
// tools). The model, the camera and the 2D↔3D sync are untouched.
//
// The frame origin (world Three.js coords [x, y, z]) only places the in-scene
// axes helper: every drawing helper works with directions anchored on its
// own point, so moving the origin changes nothing in the snaps / locks. The
// origin point itself is snappable like a vertex while the axes are shown
// (useVertexSnap buildIndex). Set by the « Orienter le repère » toolbar
// command (Features/threedAxesPlacement).

export const AXIS_COLORS = {
  X: "#e5484d", // red
  Y: "#46a758", // green
  Z: "#3b82f6", // blue
};

export const DEFAULT_AXES_ORIGIN = [0, 0, 0];

export const DEFAULT_AXES_SETTINGS = {
  showGizmo: true,
  showSceneAxes: true,
  yawDeg: 0,
  origin: DEFAULT_AXES_ORIGIN,
};

// Finite number wrapped into [0, 360); anything else → 0.
export function normalizeAxesYawDeg(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return ((v % 360) + 360) % 360;
}

// Array of 3 finite numbers (world coords); anything else → world origin.
export function normalizeAxesOrigin(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    return [...DEFAULT_AXES_ORIGIN];
  }
  const nums = value.map(Number);
  if (!nums.every(Number.isFinite)) return [...DEFAULT_AXES_ORIGIN];
  return nums;
}

// Frame at the world origin with no rotation (the « Réinitialiser » state).
export function isAxesFrameDefault({ yawDeg, origin }) {
  return (
    normalizeAxesYawDeg(yawDeg) === 0 &&
    normalizeAxesOrigin(origin).every((v) => v === 0)
  );
}

// `origin` may be missing (settings stored before it existed): the loader
// fills it from the defaults.
export function isAxesSettings(value) {
  return (
    !!value &&
    typeof value === "object" &&
    typeof value.showGizmo === "boolean" &&
    typeof value.showSceneAxes === "boolean" &&
    Number.isFinite(value.yawDeg) &&
    (value.origin === undefined ||
      (Array.isArray(value.origin) && value.origin.length === 3))
  );
}
