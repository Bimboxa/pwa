// Shared tolerances of the annotation mesh ("isMesh3d" annotations) geometry
// utils. All lengths in meters (base-map-local frame).

// Two positions closer than this are the same vertex (codebase-wide weld).
export const WELD_PRECISION_M = 1e-4;

// Max distance of a drawn point to a face plane / boundary to be "on" it.
export const ON_PLANE_TOL_M = 2e-3;
export const ON_BOUNDARY_TOL_M = 1e-3;

// |n1 · n2| below this: the two planes are perpendicular, i.e. a neighbor
// face contains the push/pull direction and is stretched instead of getting
// a new side face.
export const PARALLEL_DOT = 1e-3;

// n1 · n2 above this: same plane orientation (coplanar sibling faces).
export const COPLANAR_DOT = 1 - 1e-6;

// sin(angle) below this: three consecutive loop vertices are collinear.
export const COLLINEAR_SIN = 1e-6;

// Pushing a face inward always leaves at least this much material.
export const MIN_THICKNESS_M = 0.01;

// A lone face moved DOWN (local -z) digs an open basin instead of making a
// closed prism. "Down" = the move is within 60° of -z, the mirror of the
// extrude tool's top-face tolerance (TOP_FACE_MIN_DOT).
export const DIG_MIN_DOT = 0.5;

// A mesh whose plan projection has no area (a single face perpendicular to
// the base map) is stored as a thin quad of this width, so the 2D annotation
// stays a valid POLYGON.
export const MIN_PROJECTION_WIDTH_M = 0.005;
