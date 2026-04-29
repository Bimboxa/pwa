// Singleton accessor for the live ThreedEditor instance, so features outside
// MainThreedEditor (e.g. the photoreal export dialog in the TopBar) can reach
// the scene/camera/renderer without prop-drilling.

let activeThreedEditor = null;

export function setActiveThreedEditor(threedEditor) {
  activeThreedEditor = threedEditor;
}

export function clearActiveThreedEditor() {
  activeThreedEditor = null;
}

export function getActiveThreedEditor() {
  return activeThreedEditor;
}
