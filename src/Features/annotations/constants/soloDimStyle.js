import {
  PentagonOutlined,
  Pentagon as PentagonIcon,
  VisibilityOffOutlined,
} from "@mui/icons-material";

// Look of the annotations LEFT OUT of a solo (template, business object,
// zone, work package, annotation, revolution axis): hidden, light grey
// outline only, or grey translucent. One setting read by the 2D map editor
// (StaticMapContent ghost pass) and the 3D viewer (ThreedSelectionDimmer /
// applyAnnotationMaterialState). Per-scope local state
// (viewers.soloDimStyle), chosen from the bottom bar (ButtonSoloDimStyle).
export const SOLO_DIM_STYLE = {
  HIDDEN: "HIDDEN", // not rendered at all
  WIREFRAME: "WIREFRAME", // light grey outline / edges, no surface
  TRANSPARENT: "TRANSPARENT", // grey, translucent (the historical 3D look)
};

export const DEFAULT_SOLO_DIM_STYLE = SOLO_DIM_STYLE.TRANSPARENT;

// Shared greys: the 2D wireframe stroke and the 3D edge lines.
export const SOLO_DIM_WIREFRAME_COLOR = "#bdbdbd";
export const SOLO_DIM_WIREFRAME_COLOR_HEX = 0xbdbdbd;

// Order of the cycle of the bottom bar button's main click.
export const SOLO_DIM_STYLE_OPTIONS = [
  {
    key: SOLO_DIM_STYLE.HIDDEN,
    label: "Caché",
    tooltip: "Annotations hors solo : cachées",
    Icon: VisibilityOffOutlined,
  },
  {
    key: SOLO_DIM_STYLE.WIREFRAME,
    label: "Wireframe gris clair",
    tooltip: "Annotations hors solo : contours gris clair",
    Icon: PentagonOutlined,
  },
  {
    key: SOLO_DIM_STYLE.TRANSPARENT,
    label: "Transparent",
    tooltip: "Annotations hors solo : transparentes",
    Icon: PentagonIcon,
  },
];

export function isSoloDimStyle(value) {
  return Object.values(SOLO_DIM_STYLE).includes(value);
}

export function getSoloDimStyleOption(style) {
  return (
    SOLO_DIM_STYLE_OPTIONS.find((o) => o.key === style) ??
    SOLO_DIM_STYLE_OPTIONS.find((o) => o.key === DEFAULT_SOLO_DIM_STYLE)
  );
}

export function getNextSoloDimStyle(current) {
  const index = SOLO_DIM_STYLE_OPTIONS.findIndex((o) => o.key === current);
  return SOLO_DIM_STYLE_OPTIONS[(index + 1) % SOLO_DIM_STYLE_OPTIONS.length]
    .key;
}
