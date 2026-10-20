import IconRotateBaseMap from "Features/icons/IconRotateBaseMap";

import { setRotateBaseMapModeActive } from "Features/threedEditor/threedEditorSlice";

import createBaseMapPlacementCommand from "../../utils/createBaseMapPlacementCommand";

// « Tourner le fond de plan » (3D): rotate base map mode toggle.
export default createBaseMapPlacementCommand({
  key: "ROTATE_BASE_MAP",
  label: "Tourner le fond de plan",
  Icon: IconRotateBaseMap,
  getActive: (ctx) => ctx.rotateBaseMapModeActive,
  setActive: setRotateBaseMapModeActive,
});
