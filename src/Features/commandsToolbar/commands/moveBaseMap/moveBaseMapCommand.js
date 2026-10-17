import { OpenWith } from "@mui/icons-material";

import { setMoveBaseMapModeActive } from "Features/threedEditor/threedEditorSlice";

import createBaseMapPlacementCommand from "../../utils/createBaseMapPlacementCommand";

// « Déplacer le fond de plan » (3D): move base map mode toggle.
export default createBaseMapPlacementCommand({
  key: "MOVE_BASE_MAP",
  label: "Déplacer le fond de plan",
  Icon: OpenWith,
  getActive: (ctx) => ctx.moveBaseMapModeActive,
  setActive: setMoveBaseMapModeActive,
});
