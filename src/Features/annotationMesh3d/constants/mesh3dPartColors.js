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
