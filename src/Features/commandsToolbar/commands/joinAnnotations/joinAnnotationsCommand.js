import IconJoinAnnotations from "Features/icons/IconJoinAnnotations";

import { EDITOR_2D } from "../../constants/commandEditors";
import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Joindre » (J, 2D): joins the ends of two walls / polylines.
export default createToolGroupCommand({
  key: "JOIN_ANNOTATIONS",
  label: "Joindre",
  Icon: IconJoinAnnotations,
  editors: [EDITOR_2D],
  hotkey: { key: "j" },
});
