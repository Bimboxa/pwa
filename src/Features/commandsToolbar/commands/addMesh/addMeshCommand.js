import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";

import { setMeshingTool } from "Features/threedEditor/threedEditorSlice";

import { EDITOR_3D } from "../../constants/commandEditors";
import { getMeshingToolCommandState } from "../../utils/meshingCommandState";

// « Ajouter une maille » (3D, Maillage module — Features/threedMesh): arms
// the CREATE tool of the meshing mode (ctx.meshingTool) — a click on a face
// creates a maille from the hovered piece; with a target surface typed in
// the drawing helper (S + digits, meshingMode.surfaceBuffer) the click
// creates the pre-drawn maille of that surface instead
// (useMeshingPointerHandlers / buildFixedAreaMaille). A second click on the
// armed button — or on its hotkey, A — returns to the selection tool.
export default {
  key: "ADD_MESH",
  usesSelection: false,
  label: "Ajouter une maille",
  Icon: AddBoxOutlinedIcon,
  editors: [EDITOR_3D],
  hotkey: { key: "a", plainOnly: true, editors: [EDITOR_3D] },
  getState: (ctx) => getMeshingToolCommandState(ctx, "CREATE"),
  run(ctx, { dispatch }) {
    dispatch(
      setMeshingTool(ctx.meshingTool === "CREATE" ? "SELECT" : "CREATE")
    );
  },
};
