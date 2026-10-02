import theme from "Styles/theme";

// Colors of the face / edge feedback of a mesh annotation in the 3D editor —
// the conventions of the 2D editor (NodePolylineStatic): a SELECTED part is
// the theme's fluo green, a HOVERED segment the neon green of the 2D segment
// hover.

// three.js colors take #rrggbb: drop the alpha of an #rrggbbaa theme value.
const toHex6 = (color) =>
  typeof color === "string" && /^#[0-9a-f]{8}$/i.test(color)
    ? color.slice(0, 7)
    : color;

export const MESH3D_PART_SELECTED_COLOR =
  toHex6(theme.palette.annotation?.selectedPart) || "#2fff14";

export const MESH3D_PART_HOVER_COLOR = "#76ff03";

// Screen-space widths (px) of the edge lines.
export const MESH3D_EDGE_SELECTED_WIDTH_PX = 5;
export const MESH3D_EDGE_HOVER_WIDTH_PX = 3;

// Selected face: the hover stipple (faceHoverHighlight) in the selected
// color, without the wash between the dots — the face keeps its own color.
// The grid is shifted by half a cell so a blue hover stipple on the same face
// (push/pull, meshing) interleaves with it; not tone mapped (the realistic
// modes' ACES would dull the fluo green); drawn under the hover stipple.
export const MESH3D_FACE_SELECTED_STIPPLE = {
  color: MESH3D_PART_SELECTED_COLOR,
  baseAlpha: 0,
  dotAlpha: 0.85,
  gridOffsetPx: 3,
  toneMapped: false,
  renderOrder: 997,
};
