import { setSegmentDragEnabled } from "Features/mapEditor/mapEditorSlice";

import IconSegmentDrag from "Features/icons/IconSegmentDrag";

import createViewToggleCommand from "../../utils/createViewToggleCommand";

// « Déplacement de segment »: on, dragging a segment moves it; off, hovering a
// segment lets you add a point on it.
export default createViewToggleCommand({
  key: "TOGGLE_SEGMENT_DRAG",
  label: "Déplacement de segment (sinon : ajout d'un point au survol)",
  Icon: IconSegmentDrag,
  getValue: (ctx) => ctx.segmentDragEnabled,
  setValue: setSegmentDragEnabled,
});
