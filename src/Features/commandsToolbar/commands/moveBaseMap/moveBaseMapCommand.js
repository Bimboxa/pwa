import IconMoveBaseMap from "Features/icons/IconMoveBaseMap";

import { setMoveBaseMapModeActive } from "Features/threedEditor/threedEditorSlice";

import createBaseMapPlacementCommand from "../../utils/createBaseMapPlacementCommand";

// « Déplacer le fond de plan » (3D): move base map mode toggle.
export default createBaseMapPlacementCommand({
  key: "MOVE_BASE_MAP",
  label: "Déplacer le fond de plan",
  Icon: IconMoveBaseMap,
  getActive: (ctx) => ctx.moveBaseMapModeActive,
  setActive: setMoveBaseMapModeActive,
});
