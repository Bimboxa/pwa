import IconCutLine from "Features/icons/IconCutLine";

import { EDITOR_2D } from "../../constants/commandEditors";
import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Retirer un segment » (X): hides a segment of a polyline / polygon.
export default createToolGroupCommand({
  key: "SPLIT_LINE",
  label: "Retirer un segment",
  Icon: IconCutLine,
  editors: [EDITOR_2D],
  hotkey: { key: "x" },
});
