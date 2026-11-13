// Per-device preferences of the PopperImages panel (same shape as
// editorSettingsLocalStorage): how IMAGE annotations are displayed in the
// editors / captures and how an ex-situ tile is linked to its anchor.

const STORAGE_KEY = "popperImagesSettings";

// IN_SITU: photos drawn in the scene. EX_SITU ("overlay"): photos listed in
// the floating PopperImages panel. PRINT_ZONES: photos dispatched as tiles in
// 4 bands along the edges of the editor (or of the capture frame).
export const IMAGES_DISPLAY_MODES = ["IN_SITU", "EX_SITU", "PRINT_ZONES"];
const DEFAULT_DISPLAY_MODE = "IN_SITU";
// Ex situ tile ↔ anchor links: a leader line and / or a number badge, each
// on or off independently.
const DEFAULT_LINK_LINE = true;
const DEFAULT_LINK_NUMBER = false;
// PRINT_ZONES tiles: "AUTO" (target size, shrunk when the photos do not fit
// along the 4 edges) or "FIXED" (the stored size, never shrunk).
export const PRINT_ZONES_TILE_SIZE_MODES = ["AUTO", "FIXED"];
export const PRINT_ZONES_TILE_SIZE_DEFAULT_PX = 160;
export const PRINT_ZONES_TILE_SIZE_MIN_PX = 64;
export const PRINT_ZONES_TILE_SIZE_MAX_PX = 320;

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / serialization errors
  }
}

export function loadImagesDisplayMode() {
  const value = readStore().displayMode;
  return IMAGES_DISPLAY_MODES.includes(value) ? value : DEFAULT_DISPLAY_MODE;
}

export function saveImagesDisplayMode(mode) {
  const store = readStore();
  store.displayMode = IMAGES_DISPLAY_MODES.includes(mode)
    ? mode
    : DEFAULT_DISPLAY_MODE;
  writeStore(store);
}

export function loadImagesLinkLine() {
  const store = readStore();
  if (typeof store.linkLine === "boolean") return store.linkLine;
  // Legacy single-choice setting.
  if (store.linkStyle === "NUMBER") return false;
  return DEFAULT_LINK_LINE;
}

export function saveImagesLinkLine(enabled) {
  const store = readStore();
  store.linkLine = Boolean(enabled);
  writeStore(store);
}

export function loadImagesLinkNumber() {
  const store = readStore();
  if (typeof store.linkNumber === "boolean") return store.linkNumber;
  if (store.linkStyle === "NUMBER") return true;
  return DEFAULT_LINK_NUMBER;
}

export function saveImagesLinkNumber(enabled) {
  const store = readStore();
  store.linkNumber = Boolean(enabled);
  writeStore(store);
}

export function loadPrintZonesTileSizeMode() {
  const value = readStore().printZonesTileSizeMode;
  return PRINT_ZONES_TILE_SIZE_MODES.includes(value) ? value : "AUTO";
}

export function savePrintZonesTileSizeMode(mode) {
  const store = readStore();
  store.printZonesTileSizeMode = PRINT_ZONES_TILE_SIZE_MODES.includes(mode)
    ? mode
    : "AUTO";
  writeStore(store);
}

export function clampPrintZonesTileSizePx(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return PRINT_ZONES_TILE_SIZE_DEFAULT_PX;
  return Math.round(
    Math.min(
      PRINT_ZONES_TILE_SIZE_MAX_PX,
      Math.max(PRINT_ZONES_TILE_SIZE_MIN_PX, n)
    )
  );
}

export function loadPrintZonesTileSizePx() {
  return clampPrintZonesTileSizePx(readStore().printZonesTileSizePx);
}

export function savePrintZonesTileSizePx(value) {
  const store = readStore();
  store.printZonesTileSizePx = clampPrintZonesTileSizePx(value);
  writeStore(store);
}

// PRINT_ZONES zones the user resized: { [side]: { thickness, startInset,
// endInset } } in px (insets from the borders of the layout rect), a missing
// side / key = automatic.
export const PRINT_ZONES_SIDES = ["TOP", "RIGHT", "BOTTOM", "LEFT"];
export const PRINT_ZONES_ZONE_THICKNESS_MAX_PX = 480;
const ZONE_KEYS = ["thickness", "startInset", "endInset"];

export function sanitizePrintZonesZones(value) {
  const zones = {};
  if (!value || typeof value !== "object") return zones;
  PRINT_ZONES_SIDES.forEach((side) => {
    const zone = {};
    ZONE_KEYS.forEach((key) => {
      const raw = value[side]?.[key];
      const n = Number(raw);
      if (raw == null || !Number.isFinite(n)) return;
      zone[key] =
        key === "thickness"
          ? Math.round(
              Math.min(
                PRINT_ZONES_ZONE_THICKNESS_MAX_PX,
                Math.max(PRINT_ZONES_TILE_SIZE_MIN_PX, n)
              )
            )
          : Math.max(0, Math.round(n));
    });
    if (Object.keys(zone).length) zones[side] = zone;
  });
  return zones;
}

export function loadPrintZonesZones() {
  return sanitizePrintZonesZones(readStore().printZonesZones);
}

export function savePrintZonesZones(zones) {
  const store = readStore();
  store.printZonesZones = sanitizePrintZonesZones(zones);
  writeStore(store);
}

// Overlay panel (EX_SITU): number of columns of the photos grid.
export const PANEL_COLUMNS_OPTIONS = [1, 2];
const DEFAULT_PANEL_COLUMNS = 2;

export function loadImagesPanelColumns() {
  const value = readStore().panelColumns;
  return PANEL_COLUMNS_OPTIONS.includes(value) ? value : DEFAULT_PANEL_COLUMNS;
}

export function saveImagesPanelColumns(columns) {
  const store = readStore();
  store.panelColumns = PANEL_COLUMNS_OPTIONS.includes(columns)
    ? columns
    : DEFAULT_PANEL_COLUMNS;
  writeStore(store);
}
