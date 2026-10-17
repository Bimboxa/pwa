import { Height } from "@mui/icons-material";

import { setExtrudeModeActive } from "Features/threedEditor/threedEditorSlice";

import { EDITOR_3D } from "../../constants/commandEditors";
import { getThreedToolState } from "../../utils/drawToolCommandState";

// « Extruder » (E, 3D): threedEditor mode toggle. In 2D the letter is
// « Évider » (hollowOut command); outside both, « Élévation » of the right
// panel (useRightPanelToolHotkeys yields through the hotkey claims).
export default {
  key: "EXTRUDE",
  label: "Extruder",
  Icon: Height,
  editors: [EDITOR_3D],
  hotkey: { key: "e" },
  getState: (ctx) => getThreedToolState(ctx, ["EXTRUDE"]),
  run(ctx, { dispatch, store }) {
    dispatch(
      setExtrudeModeActive(!store.getState().threedEditor.extrudeMode.active)
    );
  },
};
