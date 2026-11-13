import IconCutSurface from "Features/icons/IconCutSurface";

import { EDITOR_2D } from "../../constants/commandEditors";
import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Couper une surface » (F, 2D — Features/surfaceCut): variants segment /
// polyline cut line.
export default createToolGroupCommand({
  key: "SURFACE_CUT",
  // The cut targets the clicked annotation, but cutting is a natural next
  // step on a selected one: kept in the toolbar on a selection.
  usesSelection: true,
  label: "Couper une surface",
  Icon: IconCutSurface,
  editors: [EDITOR_2D],
  hotkey: { key: "f" },
});
