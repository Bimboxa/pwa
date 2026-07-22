// Force a cursor globally during a drag.
//
// A plain `document.body.style.cursor` is not enough: every element with its
// own `cursor` rule (the calibration targets are `grab`, the map is `default`…)
// would win. So the cursor is injected as a `* { ... !important }` style
// element, removed at the end of the gesture.

let dragStyleEl = null;

export function setDragCursor(cursor) {
  if (!dragStyleEl) {
    dragStyleEl = document.createElement("style");
    document.head.appendChild(dragStyleEl);
  }
  dragStyleEl.textContent = `* { cursor: ${cursor} !important; }`;
}

export function clearDragCursor() {
  if (dragStyleEl) {
    dragStyleEl.remove();
    dragStyleEl = null;
  }
}
