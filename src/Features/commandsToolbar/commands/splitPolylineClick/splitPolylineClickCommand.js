import IconSplitPolylineClick from "Features/icons/IconSplitPolylineClick";

import { EDITOR_2D } from "../../constants/commandEditors";
import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Couper un segment » (C, 2D): splits a polyline at the clicked point.
export default createToolGroupCommand({
  key: "SPLIT_POLYLINE_CLICK",
  // The cut targets the clicked annotation, but cutting is a natural next
  // step on a selected one: kept in the toolbar on a selection.
  usesSelection: true,
  label: "Couper un segment",
  Icon: IconSplitPolylineClick,
  editors: [EDITOR_2D],
  hotkey: { key: "c" },
});
