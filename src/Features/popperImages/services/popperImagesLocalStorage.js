// Per-device preferences of the PopperImages panel (same shape as
// editorSettingsLocalStorage): how IMAGE annotations are displayed in the
// editors / captures and how an ex-situ tile is linked to its anchor.

const STORAGE_KEY = "popperImagesSettings";

export const IMAGES_DISPLAY_MODES = ["IN_SITU", "EX_SITU"];
const DEFAULT_DISPLAY_MODE = "IN_SITU";
// Ex situ tile ↔ anchor links: a leader line and / or a number badge, each
// on or off independently.
const DEFAULT_LINK_LINE = true;
const DEFAULT_LINK_NUMBER = false;

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
