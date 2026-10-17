import IconOpeningRectangle from "Features/icons/IconOpeningRectangle";

import { EDITOR_2D } from "../../constants/commandEditors";
import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Ouverture » (O): openings in the annotations — variants CUT_CLICK,
// CUT_RECTANGLE, CUT_CIRCLE, CUT_POLYLINE(_SEGMENT), CUT_STRIP(_SEGMENT).
// 2D editor only: the opening tools are not wired in the 3D editor yet.
export default createToolGroupCommand({
  key: "CUT",
  label: "Ouverture",
  Icon: IconOpeningRectangle,
  editors: [EDITOR_2D],
  hotkey: { key: "o" },
});
