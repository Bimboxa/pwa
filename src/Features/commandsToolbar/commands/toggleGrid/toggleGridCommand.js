import Grid4x4Icon from "@mui/icons-material/Grid4x4";

import { EDITOR_2D } from "../../constants/commandEditors";
import ButtonToggleGrid from "./ButtonToggleGrid";

// « Grille » (2D editor): toggles the editor grid — a metric grid over the
// current base map whose lines are snap targets while drawing / moving
// (Features/editorGrid, a device preference, not a base map property). Its
// button carries a small drop-down: cell size, « Grille dynamique » (the
// cell size follows the zoom). Needs the base map scale. `active` is
// resolved by the button (editorGrid slice).
export default {
  key: "TOGGLE_GRID",
  usesSelection: false,
  label: "Grille",
  Icon: Grid4x4Icon,
  editors: [EDITOR_2D],
  getState(ctx) {
    if (!ctx.hasScale) {
      return { enabled: false, reason: "Échelle du fond de plan requise" };
    }
    return { enabled: true };
  },
  Button: ButtonToggleGrid,
};
