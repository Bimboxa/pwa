import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";

import { setMeshingTool } from "Features/threedEditor/threedEditorSlice";

import { EDITOR_3D } from "../../constants/commandEditors";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
} from "../../utils/drawToolCommandState";

// « Ajouter une maille » (3D, Maillage module — Features/threedMesh): arms
// the CREATE tool of the meshing mode (ctx.meshingTool) — a click on a face
// creates a maille from the hovered piece; with a target surface typed in
// the drawing helper (S + digits, meshingMode.surfaceBuffer) the click
// creates the pre-drawn maille of that surface instead
// (useMeshingPointerHandlers / buildFixedAreaMaille). A second click on the
// armed button returns to the selection tool. No hotkey: S belongs to the
// surface input while the tool is armed.
export default {
  key: "ADD_MESH",
  label: "Ajouter une maille",
  Icon: AddBoxOutlinedIcon,
  editors: [EDITOR_3D],
  getState(ctx) {
    if (ctx.viewerKey !== "MESHES") {
      return { enabled: false, reason: "Réservé au module Maillage" };
    }
    if (ctx.viewerMode) {
      return { enabled: false, reason: ctx.readOnlyReason };
    }
    if (!ctx.selectedScopeId) {
      return { enabled: false, reason: "Sélectionnez un plan de repérage" };
    }
    if (ctx.enabledDrawingMode) {
      return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    // Meshing mode is off while another 3D mode owns the pointer (frame
    // placement, base map move / rotation).
    if (!ctx.meshingTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    return { enabled: true, active: ctx.meshingTool === "CREATE" };
  },
  run(ctx, { dispatch }) {
    dispatch(
      setMeshingTool(ctx.meshingTool === "CREATE" ? "SELECT" : "CREATE")
    );
  },
};
