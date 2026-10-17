import IconCutSurface from "Features/icons/IconCutSurface";

import { EDITOR_2D } from "../../constants/commandEditors";
import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Couper une surface » (F, 2D — Features/surfaceCut): variants segment /
// polyline cut line.
export default createToolGroupCommand({
  key: "SURFACE_CUT",
  label: "Couper une surface",
  Icon: IconCutSurface,
  editors: [EDITOR_2D],
  hotkey: { key: "f" },
});
