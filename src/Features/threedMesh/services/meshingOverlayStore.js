// Tiny external store connecting useMeshingPointerHandlers (imperative pointer
// code) to the MeshingOverlayThreed DOM overlay (React). All coordinates are
// px relative to the 3D canvas.
//
// State:
// - cursor: { x, y, label } | null — helper following the mouse
//   ("+ nouvelle maille").
// - areaChips: [{ x, y, text }] — dark chips showing the would-be areas of the
//   two pieces while a cut line hovers a maille.
// - offsetChip: { x, y, text } | null — pink "2m" chip between the reference
//   vertex and the guide vertex.

let _state = { cursor: null, areaChips: [], offsetChip: null };
const _listeners = new Set();

export function setMeshingOverlay(partial) {
  _state = { ..._state, ...partial };
  _listeners.forEach((listener) => listener());
}

export function clearMeshingOverlay() {
  setMeshingOverlay({ cursor: null, areaChips: [], offsetChip: null });
}

export function getMeshingOverlayState() {
  return _state;
}

export function subscribeMeshingOverlay(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
