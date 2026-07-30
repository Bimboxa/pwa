// Seeded entries required by selectEffectiveViewerKey (the Viewer and Zones
// modules' 2D editor is "MAP", not their own key) — kept in sync with
// viewersSlice.
const DEFAULT_EDITOR_KEY_BY_MODULE = {
  MAP: "MAP",
  THREED: "THREED",
  ZONES: "MAP",
};

// Multi-editor modules and their possible editor keys (see useViewers.jsx).
// "ZONES" is a MODULE key only: the module's 2D editor is the shared "MAP"
// instance. A legacy persisted { ZONES: "ZONES" } is therefore dropped here
// and falls back to the seeded "MAP" above.
const KNOWN_MODULE_KEYS = ["MAP", "THREED", "POINT_OF_VIEW", "ZONES"];
const KNOWN_EDITOR_KEYS = ["MAP", "THREED"];

export default function getInitEditorKeyByModule() {
  try {
    const raw = localStorage.getItem("initEditorKeyByModule");
    const parsed = raw ? JSON.parse(raw) : null;

    const restored = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      Object.entries(parsed).forEach(([moduleKey, editorKey]) => {
        if (
          KNOWN_MODULE_KEYS.includes(moduleKey) &&
          KNOWN_EDITOR_KEYS.includes(editorKey)
        ) {
          restored[moduleKey] = editorKey;
        }
      });
    }

    return { ...DEFAULT_EDITOR_KEY_BY_MODULE, ...restored };
  } catch {
    return { ...DEFAULT_EDITOR_KEY_BY_MODULE };
  }
}
