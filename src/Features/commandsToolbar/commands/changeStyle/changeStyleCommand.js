import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";

import ButtonChangeStyle from "./ButtonChangeStyle";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "../../utils/drawToolCommandState";
import { LOADING_REASON } from "../../utils/selectionCommandState";

import { CHANGE_STYLE_MODE } from "./changeStyleMode";

export { CHANGE_STYLE_MODE };

// « Changer de style »: re-templates the selected annotations (same drawing
// shape — the former right-click template menu).
// - from the right-click shortcuts menu / a group menu: opens the template
//   picker on the current selection right away (ButtonChangeStyle);
// - from the toolbar: arms the CHANGE_STYLE mode (toggle) — the helper panel
//   lists the selection, the user clicks annotations to (re)build it and
//   picks the template from the panel.
export default {
  key: "CHANGE_STYLE",
  label: "Changer de style",
  Icon: PaletteOutlinedIcon,
  Button: ButtonChangeStyle,
  getState(ctx) {
    if (ctx.enabledDrawingMode === CHANGE_STYLE_MODE) {
      return { enabled: true, active: true };
    }
    if (ctx.enabledDrawingMode) {
      return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.activeThreedTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    if (ctx.readOnly) return { enabled: false, reason: ctx.readOnlyReason };
    if (ctx.annotationsLoading) {
      return { enabled: false, reason: LOADING_REASON };
    }
    // Arming with an empty selection is fine: the mode builds it.
    return { enabled: true };
  },
};
