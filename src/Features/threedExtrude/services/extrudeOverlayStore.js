// Tiny external store connecting useExtrudePointerHandlers (imperative pointer
// code) to the ExtrudeOverlayThreed DOM overlay (React). Same pattern as
// meshingOverlayStore, reduced to the single cursor helper.
//
// State:
// - cursor: { x, y, label } | null — helper following the mouse. Coordinates
//   are px relative to the 3D canvas. Label = "Extruder" while hovering an
//   extrudable top face, then the live value once a face is armed.

let _state = { cursor: null };
const _listeners = new Set();

export function setExtrudeOverlay(partial) {
  _state = { ..._state, ...partial };
  _listeners.forEach((listener) => listener());
}

export function clearExtrudeOverlay() {
  setExtrudeOverlay({ cursor: null });
}

export function getExtrudeOverlayState() {
  return _state;
}

export function subscribeExtrudeOverlay(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
