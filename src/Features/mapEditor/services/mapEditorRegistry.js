// Singleton accessor for the live 2D map editor camera handle, so features
// outside MainMapEditorV3 (e.g. the 2D/3D viewer switch) can read/set the
// SVG viewport camera without prop-drilling. Mirrors threedEditorRegistry.

let activeMapEditor = null;

export function setActiveMapEditor(mapEditor) {
  activeMapEditor = mapEditor;
}

// Handle-aware: two MainMapEditorV3 instances (MAP, BASE_MAPS) register and
// unregister independently — a stale cleanup from one instance must not wipe
// the registration of the other. Without a handle, clears unconditionally.
export function clearActiveMapEditor(mapEditor) {
  if (mapEditor && activeMapEditor !== mapEditor) return;
  activeMapEditor = null;
}

export function getActiveMapEditor() {
  return activeMapEditor;
}

// Camera change bus: MainMapEditorV3 notifies on every pan / zoom of the
// active editor (onCameraChangeExternal) and components living outside its
// React tree (e.g. the capture frame cartouche reading the frame in image
// px) subscribe here instead of forcing a MainMapEditorV3 re-render per
// camera frame. Subscribers debounce on their side.
const cameraListeners = new Set();

export function subscribeMapEditorCamera(listener) {
  cameraListeners.add(listener);
  return () => cameraListeners.delete(listener);
}

export function notifyMapEditorCameraChange() {
  cameraListeners.forEach((listener) => listener());
}
