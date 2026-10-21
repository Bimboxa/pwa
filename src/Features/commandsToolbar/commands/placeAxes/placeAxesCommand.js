import IconPlaceAxesFrame from "Features/icons/IconPlaceAxesFrame";

import { setAxesPlacementModeActive } from "Features/threedEditor/threedEditorSlice";

import { EDITOR_3D } from "../../constants/commandEditors";
import { DRAW_IN_PROGRESS_REASON } from "../../utils/drawToolCommandState";

// « Orienter le repère » (3D): 2-click tool of Features/threedAxesPlacement —
// the 1st snapped click sets the frame origin, the in-scene axes then
// rotate live around their vertical axis towards the cursor and the 2nd
// click fixes the X axis direction. threedEditor mode toggle (the slice
// owns its mutual exclusion with the other 3D tools); the mode exits by
// itself on commit. A device preference, not a model edit: no read-only
// gating.
export default {
  key: "PLACE_AXES",
  label: "Orienter le repère",
  Icon: IconPlaceAxesFrame,
  editors: [EDITOR_3D],
  getState(ctx) {
    if (ctx.enabledDrawingMode) {
      return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    return { enabled: true, active: Boolean(ctx.axesPlacementModeActive) };
  },
  run(ctx, { dispatch }) {
    dispatch(setAxesPlacementModeActive(!ctx.axesPlacementModeActive));
  },
};
