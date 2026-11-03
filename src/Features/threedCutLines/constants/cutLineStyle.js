// Rendering + interaction constants of the cut lines (ThreedCutLineAnnotations,
// useCutLineVertexHandlers).

// Screen-space line widths (px).
export const CUT_LINE_WIDTH_PX = 2;
export const CUT_LINE_WIDTH_SELECTED_PX = 3;
export const CUT_LINE_WIDTH_HIDDEN_PX = 1;

// Dash of the derived (extended) segments of a selected line, metres.
export const CUT_LINE_DASH_M = 0.08;
export const CUT_LINE_GAP_M = 0.05;

// Vertex markers (screen px): the two ends vs the interior points, and the
// sub-selected vertex.
export const CUT_LINE_END_MARKER_PX = 14;
export const CUT_LINE_MARKER_PX = 9;
export const CUT_LINE_SELECTED_MARKER_PX = 16;

// Part of a line hidden by a « Stop » point, drawn only while selected.
export const CUT_LINE_HIDDEN_COLOR = "#9e9e9e";

// Distance (CSS px) under which the cursor grabs a vertex of the selected
// line, and the movement under which a press is a click (sub-selection).
export const CUT_LINE_VERTEX_PICK_PX = 12;
export const CUT_LINE_DRAG_THRESHOLD_PX = 4;

// Points of a line lying within this distance (m) of a face's plane count
// as drawn ON that face (clipFaceByCutLines).
export const CUT_LINE_PLANE_TOL_M = 5e-3;
