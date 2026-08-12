// Singleton accessor for the live ThreedEditor instance, so features outside
// MainThreedEditor (e.g. the photoreal export dialog in the TopBar) can reach
// the scene/camera/renderer without prop-drilling.

let activeThreedEditor = null;

// Debug handle: this registry is module-scoped, so a console session has no
// way to reach the live scene (materials, imagesMap, opacityState). Same
// opt-in diagnostic spirit as window.__DEBUG_SECTION__.
function setDebugHandle(threedEditor) {
  if (typeof window !== "undefined") window.__threedEditor = threedEditor;
}

export function setActiveThreedEditor(threedEditor) {
  activeThreedEditor = threedEditor;
  setDebugHandle(threedEditor);
}

export function clearActiveThreedEditor() {
  activeThreedEditor = null;
  setDebugHandle(null);
}

export function getActiveThreedEditor() {
  return activeThreedEditor;
}
