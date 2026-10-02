// Tiny external store connecting useMeshBrushPointerHandlers (imperative
// pointer code) to the MeshBrushOverlayThreed DOM overlay (React) — same
// pattern as extrudeOverlayStore.
//
// State (coordinates are px relative to the 3D canvas):
// - cursor: { x, y, label, tone } | null — helper following the mouse.
//   tone: "PAINT" (« Peindre »), "REMOVE" (« Retirer »), "REPLACE"
//   (« Remplacer « X » ») or "REFUSED" (the refusal reason).

let _state = { cursor: null };
const _listeners = new Set();

export function setMeshBrushOverlay(partial) {
  _state = { ..._state, ...partial };
  _listeners.forEach((listener) => listener());
}

export function clearMeshBrushOverlay() {
  if (!_state.cursor) return;
  setMeshBrushOverlay({ cursor: null });
}

export function getMeshBrushOverlayState() {
  return _state;
}

export function subscribeMeshBrushOverlay(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
