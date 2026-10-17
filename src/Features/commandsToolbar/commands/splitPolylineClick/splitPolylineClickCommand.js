import IconSplitPolylineClick from "Features/icons/IconSplitPolylineClick";

import { EDITOR_2D } from "../../constants/commandEditors";
import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Couper un segment » (C, 2D): splits a polyline at the clicked point.
export default createToolGroupCommand({
  key: "SPLIT_POLYLINE_CLICK",
  label: "Couper un segment",
  Icon: IconSplitPolylineClick,
  editors: [EDITOR_2D],
  hotkey: { key: "c" },
});
