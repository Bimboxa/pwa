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
//
// « Coupe par angle » (DRAW_CUT_ANGLE) shares the store. Its pending is
// { kind: "ANGLE", p1, p2, p3, axis, angleDeg, stations, candidates } (p1 =
// pivot, p2 = reference, p3 = the clicked angle point, axis = unit world
// direction of the rotation axis, stations from getCutAngleStations). Its
// reference point (second click) lives in `angleRef` until the third click:
// no vertex is drawn for it, the rubber band keeps starting on the pivot.

let _pending = null;
let _angleRef = null;
const _listeners = new Set();

export function setCutAngleRef(point) {
  _angleRef = point ?? null;
  _listeners.forEach((listener) => listener());
}

export function getCutAngleRef() {
  return _angleRef;
}

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
