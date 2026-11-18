import JoinFullIcon from "@mui/icons-material/JoinFull";

import ButtonMergeAdjacentMeshes from "./ButtonMergeAdjacentMeshes";
import { EDITOR_3D } from "../../constants/commandEditors";
import { getMeshingCommandDisabledState } from "../../utils/meshingCommandState";

// « Fusionner les mailles adjacentes » (3D, Maillage module —
// Features/threedMesh): merges, over the whole scope, the mailles touching
// along a stretch no cut line separates (mergeAdjacentMeshes3dService). The
// button owns the busy state (ButtonMergeAdjacentMeshes).
export default {
  key: "MERGE_ADJACENT_MESHES",
  usesSelection: false,
  label: "Fusionner les mailles adjacentes",
  Icon: JoinFullIcon,
  Button: ButtonMergeAdjacentMeshes,
  editors: [EDITOR_3D],
  getState: (ctx) => getMeshingCommandDisabledState(ctx) ?? { enabled: true },
};
