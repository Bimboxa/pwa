export const BASE_MAPS_GRID_PHASE = {
  CLOSED: "CLOSED",
  OPENING_ZOOM: "OPENING_ZOOM", // editor camera flying out
  OPENING_FADE: "OPENING_FADE", // grid mounted, table + other sheets fading in
  OPEN: "OPEN",
  CLOSING_FADE: "CLOSING_FADE", // table + other sheets fading out
  CLOSING_ZOOM: "CLOSING_ZOOM", // grid camera flying to the opened sheet
};

// Share of the viewport covered by the sheet when the editor hands over to
// the grid.
export const SHEET_VIEWPORT_RATIO = 0.5;

export const ZOOM_DURATION_MS = 450;
export const FADE_DURATION_MS = 200;
export const FIT_DURATION_MS = 350;
// The sheets lie flat on the table. Hovered / selected, a sheet rises a
// little (RAISE); in the "Réorganiser" mode they all lift off the table (LIFT).
export const LIFT_DURATION_MS = 250;
export const RAISE_OFFSET = 6;
export const LIFT_OFFSET = 12;

// Screen px kept free around the sheet once opened in the editor.
export const OPENED_SHEET_PADDING = 32;

export const TABS_HEIGHT = 44;

// Display of the base map images on the sheets
export const BASE_MAPS_GRID_IMAGE_MODE = {
  NONE: "NONE", // annotations only
  FADED: "FADED", // light grey image, the annotations stand out
  FULL: "FULL", // as displayed in the map editor
};
export const FADED_IMAGE_OPACITY = 0.35;
// The table keeps the editor background (theme background.default); the
// tabs band and the unselected tabs are darker shades of it.
export const TABS_BAND_DARKEN = 0.1;
export const TAB_DARKEN = 0.05;
export const TAB_HOVER_DARKEN = 0.02;

// Placeholder sheet ("+", creates a base map) closing the grid: A3 landscape.
export const ADD_SHEET_ID = "__ADD_BASE_MAP__";
export const ADD_SHEET_SIZE = { width: 1191, height: 842 };
