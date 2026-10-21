import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { resetAxesFrame } from "Features/threedEditor/threedEditorSlice";

import { EDITOR_3D } from "../../constants/commandEditors";

const ALREADY_DEFAULT_REASON = "Repère déjà à l'origine, sans rotation";

// « Réinitialiser le repère » (3D): puts the user frame back to the world
// origin with no rotation (threedEditor.axesSettings yawDeg 0 + origin
// [0, 0, 0]). The 3D drawing helpers (axis locks, in-plane snaps, face
// cuts) follow the frame rotation, so this also restores the world axes
// for them. Disabled while the frame already is at its default.
export default {
  key: "RESET_AXES",
  label: "Réinitialiser le repère",
  Icon: RestartAltIcon,
  editors: [EDITOR_3D],
  getState(ctx) {
    if (ctx.axesFrameIsDefault) {
      return { enabled: false, reason: ALREADY_DEFAULT_REASON };
    }
    return { enabled: true };
  },
  run(ctx, { dispatch }) {
    dispatch(resetAxesFrame());
  },
};
