// Leaf module (no imports): shared by the pure utils (node-testable), the
// services and the 3D layer of the « Pinceau » (MESH_BRUSH) tool.

// Drawing tool key of the 3D brush. Distinct from the 2D "BRUSH" tool (raster
// mask → polygons), which the hidden 2D InteractionLayer still reacts to.
export const MESH_BRUSH_TOOL_KEY = "MESH_BRUSH";

export const MESH_PAINT_PART_TYPES = {
  FACE: "FACE",
  EDGE: "EDGE",
};

export const MESH_PAINT_SYNC_STATES = {
  OK: "OK",
  ORPHAN: "ORPHAN",
};

// Read-time status of a listed paint (resolveMeshPaints).
export const MESH_PAINT_STATUS = {
  OK: "OK", // counted and rendered
  ORPHAN: "ORPHAN", // host face lost: listed, rendered dimmed, not counted
  CONFLICT: "CONFLICT", // same part painted twice (merge): loser, not counted
};

// --- matching (one template per facet side / edge) ---
export const MATCH_ANGLE_DEG = 1;
export const MATCH_PLANE_GAP_M = 0.003;
export const MATCH_MIN_OVERLAP_RATIO = 0.5;

// --- re-sync ---
// Stage 1: parallel planes / lines within this distance (absorbs the 1 mm
// z-fight lifts and the 10 mm anti-aliasing shrink of a host that just lost
// it).
export const RESYNC_NEAR_M = 0.02;
// Stage 2: two far candidates closer than this ratio of their distances are
// ambiguous → no match (orphan).
export const RESYNC_AMBIGUITY_RATIO = 0.1;
// A re-synced geometry is written only when a vertex moved more than this.
export const RESYNC_WRITE_TOL_M = 0.002;
// Quantization of the host geometry hash (0.1 mm).
export const GEOM_HASH_QUANTUM_M = 1e-4;

// --- picking ---
// Plane-mode region angle: 0 breaks on float noise between truly coplanar
// triangles (cos(0) = 1).
export const BRUSH_FACE_ANGLE_DEG = 0.1;
// Pointer travel (px) beyond which a press is an orbit drag, not a click.
export const BRUSH_DRAG_PX = 4;
// Screen distance (px) of the edge pick.
export const BRUSH_EDGE_PICK_PX = 10;
// Collinear merge of edge pieces into one straight edge.
export const EDGE_COLLINEAR_DEG = 0.5;
// Inside / outside parity probe offset along the painted side's normal.
export const INSIDE_PROBE_M = 0.005;

// --- rendering ---
export const PAINT_FACE_LIFT_M = 0.001;
export const PAINT_EDGE_WIDTH_PX = 4;
export const PAINT_FACE_RENDER_ORDER = 2;
export const PAINT_EDGE_RENDER_ORDER = 996;
