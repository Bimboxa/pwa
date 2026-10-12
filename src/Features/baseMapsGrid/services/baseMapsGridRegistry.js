// The mounted 2D base maps grid (LayerBaseMapsGrid) registers a handle here
// so that code outside the editor can read its camera — the 2D -> 3D toggle
// of the pinned grid (useToggleModuleEditor) poses the 3D camera on the
// editor camera, which the grid parked when it opened: the handle gives the
// editor camera equivalent to the GRID camera the user has panned / zoomed.
// Mirrors mapEditorRegistry (one grid displayed at a time).
let activeBaseMapsGrid = null;

// handle: { getEditorCameraFromGrid(): cameraMatrix | null } or null
export function setActiveBaseMapsGrid(handle) {
  activeBaseMapsGrid = handle;
}

export function clearActiveBaseMapsGrid(handle) {
  if (activeBaseMapsGrid === handle) activeBaseMapsGrid = null;
}

export function getActiveBaseMapsGrid() {
  return activeBaseMapsGrid;
}
