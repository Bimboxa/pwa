import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

import ButtonDeleteAllMeshes from "./ButtonDeleteAllMeshes";
import { EDITOR_3D } from "../../constants/commandEditors";
import { getMeshingCommandDisabledState } from "../../utils/meshingCommandState";

// « Supprimer toutes les mailles » (3D, Maillage module —
// Features/threedMesh): deletes every maille of the scope after a
// confirmation (ButtonDeleteAllMeshes owns the dialog and the busy state).
export default {
  key: "DELETE_ALL_MESHES",
  usesSelection: false,
  label: "Supprimer toutes les mailles",
  Icon: DeleteSweepIcon,
  Button: ButtonDeleteAllMeshes,
  editors: [EDITOR_3D],
  getState: (ctx) => getMeshingCommandDisabledState(ctx) ?? { enabled: true },
};
