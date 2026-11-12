// Module-level state of the pointer over the SELECTED cut line, shared by
// its two gestures (useCutLineVertexHandlers: a vertex,
// useCutLineTranslateHandlers: a segment) and read by the Maillage hover
// (useMeshingPointerHandlers rewrites the canvas cursor on every frame: it
// must keep the hand, and stand down while one of the gestures runs).

const _hover = { VERTEX: false, SEGMENT: false };
let _dragging = false;

// A grabbable part of the selected line is under the cursor (hand cursor).
export function getCutLineGrabHover() {
  return _hover.VERTEX || _hover.SEGMENT;
}

// part: "VERTEX" | "SEGMENT". The canvas cursor follows the aggregate (set
// only when it changes, so the cursor of another tool is left alone).
export function setCutLineGrabHover(part, over, dom) {
  const before = getCutLineGrabHover();
  _hover[part] = Boolean(over);
  const after = getCutLineGrabHover();
  if (dom && before !== after && !_dragging) {
    dom.style.cursor = after ? "grab" : "";
  }
}

// A vertex / segment gesture of the selected line is running.
export function isCutLineDragging() {
  return _dragging;
}

export function setCutLineDragging(dragging) {
  _dragging = Boolean(dragging);
}
