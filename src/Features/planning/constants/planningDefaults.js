// Time planning defaults + grid geometry (px).

export const DEFAULT_STEP_HOURS = 4;
export const MIN_STEP_HOURS = 4;
export const MAX_STEP_HOURS = 8;
export const DEFAULT_HOURS_PER_DAY = 8;
// First working hour of a day (column sub-labels in CALENDAR mode).
export const DAY_START_HOUR = 8;

export const TIME_AXIS_MODES = [
  { key: "CALENDAR", label: "Calendrier" },
  { key: "STEPS", label: "Pas de temps" },
];
export const DEFAULT_TIME_AXIS_MODE = "CALENDAR";

// Grid geometry.
export const COL_WIDTH = 40;
export const ROW_HEIGHT = 32;
export const HEADER_HEIGHT = 44;
export const LEFT_COL_WIDTH = 160;
export const MIN_COLUMNS = 40;
export const TRAILING_COLUMNS = 10;

// Bottom panel.
export const PANEL_MIN_HEIGHT = 120;
export const PANEL_DEFAULT_HEIGHT = 280;
export const PANEL_MAX_HEIGHT_RATIO = 0.8;
export const PANEL_HANDLE_HEIGHT = 14;
