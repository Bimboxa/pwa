import { Lock } from "@mui/icons-material";

import { setAnglesLocked } from "Features/mapEditor/mapEditorSlice";

import createViewToggleCommand from "../../utils/createViewToggleCommand";

// « Angles verrouillés »: moving a point / a segment or editing a cote keeps
// every joint angle (a rectangle stays a rectangle).
export default createViewToggleCommand({
  key: "TOGGLE_ANGLES_LOCKED",
  label: "Angles verrouillés (conserver les angles lors des déplacements)",
  Icon: Lock,
  getValue: (ctx) => ctx.anglesLocked,
  setValue: setAnglesLocked,
});
