// Per-device preferences of the PopperImages panel (same shape as
// editorSettingsLocalStorage): how IMAGE annotations are displayed in the
// editors / captures and how an ex-situ tile is linked to its anchor.

const STORAGE_KEY = "popperImagesSettings";

export const IMAGES_DISPLAY_MODES = ["IN_SITU", "EX_SITU"];
export const IMAGES_LINK_STYLES = ["LINE", "NUMBER"];
const DEFAULT_DISPLAY_MODE = "IN_SITU";
const DEFAULT_LINK_STYLE = "LINE";

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

export function loadImagesLinkStyle() {
  const value = readStore().linkStyle;
  return IMAGES_LINK_STYLES.includes(value) ? value : DEFAULT_LINK_STYLE;
}

export function saveImagesLinkStyle(style) {
  const store = readStore();
  store.linkStyle = IMAGES_LINK_STYLES.includes(style)
    ? style
    : DEFAULT_LINK_STYLE;
  writeStore(store);
}
