import { MyLocation } from "@mui/icons-material";

import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";

// Resolve the "Localiser" action-button presentation for a library object:
// drawing figures show their configured tool's icon + label (e.g. the
// center/radius circle icon); other placeable objects (3D) fall back to the
// location icon. `placeable` gates whether the button is shown at all.
export default function getObjectActionButton(object) {
  const tool = object?.tool ? getDrawingToolByKey(object.tool) : null;
  return {
    placeable: Boolean(object?.tool || object?.file3d),
    Icon: tool?.Icon ?? MyLocation,
    tooltip: tool ? `Dessiner - ${tool.label}` : "Localiser",
  };
}
