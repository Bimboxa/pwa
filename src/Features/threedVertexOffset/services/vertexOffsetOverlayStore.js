// Tiny external store connecting useVertexOffsetPointerHandlers (imperative
// pointer code) to the VertexOffsetOverlayThreed DOM overlay (React). Same
// pattern as extrudeOverlayStore.
//
// State (coordinates are px relative to the 3D canvas):
// - cursor: { x, y, label } | null — helper following the mouse: the live
//   offset value once a vertex is armed.
// - snap: { x, y, kind } | null — the scene vertex ("VERTEX") or the point on
//   the scene edge ("EDGE") the armed vertex is levelled on.
// - axisLine: { from: {x, y}, to: {x, y} } | null — the vertical helper
//   through the armed vertex (the base map normal).

let _state = { cursor: null, snap: null, axisLine: null };
const _listeners = new Set();

export function setVertexOffsetOverlay(partial) {
  _state = { ..._state, ...partial };
  _listeners.forEach((listener) => listener());
}

export function clearVertexOffsetOverlay() {
  setVertexOffsetOverlay({ cursor: null, snap: null, axisLine: null });
}

export function getVertexOffsetOverlayState() {
  return _state;
}

export function subscribeVertexOffsetOverlay(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
