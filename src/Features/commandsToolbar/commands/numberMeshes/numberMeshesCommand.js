import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";

import { setMeshingTool } from "Features/threedEditor/threedEditorSlice";

import { EDITOR_3D } from "../../constants/commandEditors";
import { getMeshingToolCommandState } from "../../utils/meshingCommandState";

// « Numéroter » (3D, Maillage module — Features/threedMesh): arms the NUMBER
// tool of the meshing mode — a click on a maille gives it the next number
// (meshingMode.numberingNext, the « Démarrage » field of the drawing helper
// — SectionMeshNumberHelperContent), then +1 (useMeshingPointerHandlers). A
// second click on the armed button, or Escape, returns to the selection
// tool.
export default {
  key: "NUMBER_MESHES",
  usesSelection: false,
  label: "Numéroter",
  Icon: FormatListNumberedIcon,
  editors: [EDITOR_3D],
  getState: (ctx) => getMeshingToolCommandState(ctx, "NUMBER"),
  run(ctx, { dispatch }) {
    dispatch(
      setMeshingTool(ctx.meshingTool === "NUMBER" ? "SELECT" : "NUMBER")
    );
  },
};
