// 3D mesh cells ("mailles") — shared constants.

// Mailles are drawn as SURFACES (no thickness): a maille face is the flat
// polygon itself, kept off the source face by polygon offset plus this tiny
// lift (meters) along the face normal. A real extrusion would show its rim
// edges and cannot represent a curved (shell) maille.
export const MESH3D_LIFT_M = 0.001;

// Display label = mesh3d.label ?? `${prefix}${mesh3d.number}`. The prefix is
// configurable per scope (scope.mesh3dSettings.labelPrefix).
export const DEFAULT_MESH3D_LABEL_PREFIX = "M-";

export const DEFAULT_MESH3D_COLOR = "#7B1FA2";

// Selection slice item type for mailles.
export const MESH3D_SELECTION_TYPE = "MESH3D";

// Screen-space snap radius (px) for guide-vertex / edge snapping in cut tools.
export const MESH3D_SNAP_PX = 10;
