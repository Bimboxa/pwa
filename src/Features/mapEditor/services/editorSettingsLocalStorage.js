const STORAGE_KEY = "mapEditorSettings";

// Allowed vertex handle size multipliers (kept in sync with the
// SelectorEditorSettings popover). The reference (×1) is the historical
// hardcoded size.
const ALLOWED_VERTEX_MULTIPLIERS = [1, 1.5, 2];
const DEFAULT_VERTEX_MULTIPLIER = 1;

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

export function loadVertexSizeMultiplier() {
  const store = readStore();
  const value = Number(store.vertexSizeMultiplier);
  if (ALLOWED_VERTEX_MULTIPLIERS.includes(value)) return value;
  return DEFAULT_VERTEX_MULTIPLIER;
}

export function saveVertexSizeMultiplier(multiplier) {
  const value = Number(multiplier);
  const store = readStore();
  store.vertexSizeMultiplier = ALLOWED_VERTEX_MULTIPLIERS.includes(value)
    ? value
    : DEFAULT_VERTEX_MULTIPLIER;
  writeStore(store);
}
