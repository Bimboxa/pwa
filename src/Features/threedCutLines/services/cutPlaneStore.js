// Tiny external store of the « Plan de coupe » command (DRAW_CUT_PLANE):
// connects the click / key handler (useDrawingPointerHandlers) to the 3D
// overlay (CutPlaneOverlayThreed) and the drawing helper.
//
// pending: null until the second click, else {
//   p1, p2,       // world {x, y, z}: the drawn axis (P2 as clicked — the
//                 // typed length is already applied by the snap)
//   stations,     // [{ point, normal }] the cut planes (getCutPlaneStations)
//   candidates,   // [{ points, closed, stationIndex }] world cut lines
//                 // waiting for Space / Enter (computeCutPlaneLines)
// }

let _pending = null;
const _listeners = new Set();

export function setCutPlanePending(pending) {
  _pending = pending;
  _listeners.forEach((listener) => listener());
}

export function clearCutPlanePending() {
  if (_pending) setCutPlanePending(null);
}

export function getCutPlanePending() {
  return _pending;
}

export function subscribeCutPlanePending(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
