// Module-level holder for the horizontal cuts of the revolution axes built in
// the 3D scene (mirror of revolutionAxisHandlesStore).
// ThreedRevolutionAxisHorizontalCuts publishes one entry per cut on every
// rebuild; useRevolutionAxisCutHandleDragHandlers raycasts their handles
// (Sprites, invisible to the annotation pick) and drives the preview.
//
// Entry: { axisId, getRoots() (objects of the annotations being cut),
// handle (Sprite), z, setZ(z) (preview: plane, handle and
// contour follow), zOfWorldPoint(Vector3) (altitude of a point along the
// axis), zOfRay(Ray) (altitude of the point of the axis closest to a ray) }.

let _cuts = [];

export function setRevolutionAxisCuts(cuts) {
  _cuts = cuts || [];
}

export function getRevolutionAxisCuts() {
  return _cuts;
}

// DOM overlay of the handle drag (RevolutionAxisCutOverlayThreed), px
// relative to the 3D canvas:
// - snap: { x, y } | null — the scene vertex the cut takes its altitude from;
// - cursor: { x, y, label } | null — the live altitude next to the mouse.
let _overlay = { snap: null, cursor: null };
const _overlayListeners = new Set();

export function setRevolutionAxisCutOverlay(partial) {
  _overlay = { ..._overlay, ...partial };
  _overlayListeners.forEach((listener) => listener());
}

export function clearRevolutionAxisCutOverlay() {
  if (!_overlay.snap && !_overlay.cursor) return;
  setRevolutionAxisCutOverlay({ snap: null, cursor: null });
}

export function getRevolutionAxisCutOverlayState() {
  return _overlay;
}

export function subscribeRevolutionAxisCutOverlay(listener) {
  _overlayListeners.add(listener);
  return () => _overlayListeners.delete(listener);
}
