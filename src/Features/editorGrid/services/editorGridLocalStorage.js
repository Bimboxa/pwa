// Persisted settings of the editor grid (« Grille » command): a device
// preference, like the commands toolbar layout.
const STORAGE_KEY = "editorGrid";

export const DEFAULT_GRID_STEP_M = 1;

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

export function loadEditorGridSettings() {
  const store = readStore();
  const stepM = Number(store.stepM);
  return {
    enabled: Boolean(store.enabled),
    stepM: stepM > 0 ? stepM : DEFAULT_GRID_STEP_M,
    dynamic: Boolean(store.dynamic),
  };
}

export function saveEditorGridSettings(settings) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readStore(), ...settings })
    );
  } catch {
    // ignore quota / serialization errors
  }
}
