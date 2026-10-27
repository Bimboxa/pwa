// Persisted layout of the unified commands toolbar (CommandsToolbar): dock
// side, floating position, the last-used command of every UI group and the
// ordered commands of the right-click shortcuts menu. Same read/write pattern
// as mapEditor/services/editorSettingsLocalStorage.js.
const STORAGE_KEY = "commandsToolbar";

export const TOOLBAR_DOCKS = ["TOP", "BOTTOM", "LEFT", "FLOATING"];

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

export function loadCommandsToolbarLayout() {
  const store = readStore();
  const dock = TOOLBAR_DOCKS.includes(store.dock) ? store.dock : undefined;
  const position =
    store.position &&
    Number.isFinite(store.position.x) &&
    Number.isFinite(store.position.y)
      ? { x: store.position.x, y: store.position.y }
      : undefined;
  const lastUsedByGroup =
    store.lastUsedByGroup && typeof store.lastUsedByGroup === "object"
      ? store.lastUsedByGroup
      : undefined;
  const shortcutCommandKeys = Array.isArray(store.shortcutCommandKeys)
    ? store.shortcutCommandKeys.filter((k) => typeof k === "string")
    : undefined;
  return { dock, position, lastUsedByGroup, shortcutCommandKeys };
}

export function saveCommandsToolbarLayout({
  dock,
  position,
  lastUsedByGroup,
  shortcutCommandKeys,
}) {
  const store = readStore();
  if (dock !== undefined) store.dock = dock;
  if (position !== undefined) store.position = position;
  if (lastUsedByGroup !== undefined) store.lastUsedByGroup = lastUsedByGroup;
  if (shortcutCommandKeys !== undefined)
    store.shortcutCommandKeys = shortcutCommandKeys;
  writeStore(store);
}
