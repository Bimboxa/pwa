import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";

import ButtonHideAnnotation from "./ButtonHideAnnotation";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "../../utils/drawToolCommandState";

import { HIDE_ANNOTATION_MODE } from "./hideAnnotationMode";

export { HIDE_ANNOTATION_MODE };

// « Masquer l'annotation »: hides annotations — or faces of a mesh
// annotation — for the session (Features/hiddenAnnotations: display only,
// the hidden items leave the 2D editor and the 3D scene, picking included).
// - with a selection: hides it right away (the selected faces of a mesh
//   annotation, else the selected annotations — resolveHideSelection);
// - without one: arms the HIDE_ANNOTATION mode (toggle) — every click on an
//   annotation hides it, Escape leaves.
// The arrow next to the button lists the hidden items (ButtonHideAnnotation).
// Display only: offered in a read-only scope too.
export default {
  key: "HIDE_ANNOTATION",
  usesSelection: true,
  label: "Masquer l'annotation",
  Icon: VisibilityOffOutlinedIcon,
  Button: ButtonHideAnnotation,
  getState(ctx) {
    if (ctx.enabledDrawingMode === HIDE_ANNOTATION_MODE) {
      return { enabled: true, active: true };
    }
    if (ctx.enabledDrawingMode) {
      return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.activeThreedTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    return { enabled: true };
  },
};
