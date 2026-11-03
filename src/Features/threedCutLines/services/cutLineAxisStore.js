// Tiny external store connecting CutLineAxisOverlayThreed (the hover of the
// X / Y / Z axis tools of the cut line, imperative pointer code) to the
// click / Enter handler (useDrawingPointerHandlers) and the chip rendered by
// the overlay.
//
// hover: null when no planar face is hovered, else {
//   nodeId,        // hovered annotation
//   usable,        // false when the axis is (nearly) normal to the face
//   chordWorld,    // [{x, y, z, nodeId, faceNormal} x2] the trace on the
//                  // face, or null when the (typed) line misses it
//   distance, snapped, locked,
//   chip,          // { x, y, text } px on the canvas, or null
// }

let _hover = null;
const _listeners = new Set();

export function setCutLineAxisHover(hover) {
  _hover = hover;
  _listeners.forEach((listener) => listener());
}

export function getCutLineAxisHover() {
  return _hover;
}

export function subscribeCutLineAxisHover(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
