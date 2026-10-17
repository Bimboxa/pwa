import { Straighten } from "@mui/icons-material";

import { setShowSegmentCotes } from "Features/mapEditor/mapEditorSlice";

import createViewToggleCommand from "../../utils/createViewToggleCommand";

// « Afficher / Masquer les cotes » of the selected annotation's segments
// (no-mode toggle; EDIT mode always shows them). Needs the base map scale.
export default createViewToggleCommand({
  key: "TOGGLE_SEGMENT_COTES",
  label: "Afficher / Masquer les cotes",
  Icon: Straighten,
  getValue: (ctx) => ctx.showSegmentCotes,
  setValue: setShowSegmentCotes,
  extraCheck: (ctx) =>
    ctx.hasScale
      ? null
      : { enabled: false, reason: "Échelle du fond de plan requise" },
});
