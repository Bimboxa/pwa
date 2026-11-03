import ShowChart from "@mui/icons-material/ShowChart";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { EDITOR_3D } from "../../constants/commandEditors";
import { DRAW_IN_PROGRESS_REASON } from "../../utils/drawToolCommandState";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";
import ButtonAddProfileLine from "./ButtonAddProfileLine";

export const DRAWING_MODE = "ADD_PROFILE_LINE";

const TYPES_2D = ["POLYGON", "POLYLINE"];
const TYPES_2D_REASON = "Réservé aux surfaces et aux lignes";
const TYPES_3D = ["POLYLINE"];
const TYPES_3D_REASON = "Réservé aux lignes";

// « Ajouter un profil » on the selected POLYGON / POLYLINE: the button opens
// a menu — draw the profile (ADD_PROFILE_LINE drawing mode of the 2D
// InteractionLayer, its vertical projection is then edited in the Élévation
// panel) or apply an existing annotation flagged « Profil » (POLYLINE hosts,
// applyProfileFromAnnotationService). Available in BOTH editors: the 3D
// editor cannot draw a profile line, so there the menu only offers the
// existing profiles (POLYLINE selection required) and `run` (hotkeys /
// shortcuts, the plain drawing-mode toggle in 2D) is a no-op.
export default {
  key: "ADD_PROFILE_LINE",
  label: "Ajouter un profil",
  Icon: ShowChart,
  Button: ButtonAddProfileLine,
  getState(ctx) {
    const is3d = ctx.editor === EDITOR_3D;
    if (!is3d && ctx.enabledDrawingMode === DRAWING_MODE) {
      return { enabled: true, active: true };
    }
    const state = is3d
      ? getSingleAnnotationState(ctx, TYPES_3D, TYPES_3D_REASON)
      : getSingleAnnotationState(ctx, TYPES_2D, TYPES_2D_REASON);
    if (!state.enabled) return state;
    if (ctx.enabledDrawingMode) {
      return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    return { enabled: true };
  },
  run(ctx, { dispatch }) {
    if (ctx.editor === EDITOR_3D) return;
    dispatch(
      setEnabledDrawingMode(
        ctx.enabledDrawingMode === DRAWING_MODE ? null : DRAWING_MODE
      )
    );
  },
};
