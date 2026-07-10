// 3D mesh cells ("mailles") — shared constants.

// Extrusion depth (meters) applied along the face normal so a maille never
// z-fights with the source face it was created from.
export const MESH3D_EXTRUDE_M = 0.005;

// Display label = mesh3d.label ?? `${prefix}${mesh3d.number}`. The prefix is
// configurable per scope (scope.mesh3dSettings.labelPrefix).
export const DEFAULT_MESH3D_LABEL_PREFIX = "M-";

export const DEFAULT_MESH3D_COLOR = "#7B1FA2";

// Selection slice item type for mailles.
export const MESH3D_SELECTION_TYPE = "MESH3D";

// Screen-space snap radius (px) for guide-vertex / edge snapping in cut tools.
export const MESH3D_SNAP_PX = 10;
