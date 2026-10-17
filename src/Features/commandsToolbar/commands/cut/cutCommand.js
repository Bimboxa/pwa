import { StopCircle } from "@mui/icons-material";

import createToolGroupCommand from "../../utils/createToolGroupCommand";

// « Ouverture » (O): openings in the annotations — variants CUT_CLICK,
// CUT_RECTANGLE, CUT_CIRCLE, CUT_POLYLINE(_SEGMENT), CUT_STRIP(_SEGMENT).
export default createToolGroupCommand({
  key: "CUT",
  label: "Ouverture",
  Icon: StopCircle,
  hotkey: { key: "o" },
});
