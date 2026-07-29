// Seeded entries required by selectEffectiveViewerKey (the Viewer module's 2D
// editor is "MAP", not its own key) — kept in sync with viewersSlice.
const DEFAULT_EDITOR_KEY_BY_MODULE = { MAP: "MAP", THREED: "THREED" };

// Multi-editor modules and their possible editor keys (see useViewers.jsx).
const KNOWN_MODULE_KEYS = ["MAP", "THREED", "POINT_OF_VIEW", "ZONES"];
const KNOWN_EDITOR_KEYS = ["MAP", "THREED", "ZONES"];

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
