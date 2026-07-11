// Singleton accessor for the live 2D map editor camera handle, so features
// outside MainMapEditorV3 (e.g. the 2D/3D viewer switch) can read/set the
// SVG viewport camera without prop-drilling. Mirrors threedEditorRegistry.

let activeMapEditor = null;

export function setActiveMapEditor(mapEditor) {
  activeMapEditor = mapEditor;
}

export function clearActiveMapEditor() {
  activeMapEditor = null;
}

export function getActiveMapEditor() {
  return activeMapEditor;
}
