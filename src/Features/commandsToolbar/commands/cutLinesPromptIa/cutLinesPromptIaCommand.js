import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import ButtonCutLinesPromptIa from "./ButtonCutLinesPromptIa";
import { EDITOR_3D } from "../../constants/commandEditors";
import { getMeshingCommandDisabledState } from "../../utils/meshingCommandState";

// « Ligne de coupe – prompt IA » (3D, Maillage module —
// Features/threedCutLines): a dialog hands an external AI chat the faces of
// the visible annotations and the cut lines already drawn, for a target max
// surface of a maille, then creates the cut lines (and the cotes setting out
// the points that are not corners) from the pasted answer.
export default {
  key: "CUT_LINES_PROMPT_IA",
  usesSelection: false,
  label: "Ligne de coupe – prompt IA",
  Icon: AutoAwesomeIcon,
  Button: ButtonCutLinesPromptIa,
  editors: [EDITOR_3D],
  getState: (ctx) => getMeshingCommandDisabledState(ctx) ?? { enabled: true },
};
