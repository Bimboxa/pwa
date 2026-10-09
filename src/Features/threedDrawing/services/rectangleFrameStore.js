// Module-level holder of the rectangle being drawn in 3D (lastSnapStore
// pattern): the four corners previewed by DrawingOverlayThreed for the
// current cursor / typed dimensions, the letters of its two sides (the user
// axis each side runs along, or a fallback typing letter) and whether it lies
// in its anchor's base map image frame. The click handler commits exactly
// the previewed corners and maps the X / Y / Z keys to the sides. Kept while
// the pointer is off the canvas; cleared with the anchor.
//
// { corners: [Vector3 x4] | null, sideAxes: ["X"|"Y"|"Z", "X"|"Y"|"Z"],
//   onBaseMap: boolean } | null

let _frame = null;

export const DEFAULT_RECT_SIDE_AXES = ["X", "Y"];

export function getRectangleFrame() {
  return _frame;
}

export function setRectangleFrame(frame) {
  _frame = frame;
}
