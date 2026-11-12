import GridOnIcon from "@mui/icons-material/GridOn";

import ButtonCreateMeshes from "./ButtonCreateMeshes";
import { EDITOR_3D } from "../../constants/commandEditors";
import { getMeshingCommandDisabledState } from "../../utils/meshingCommandState";

// « Mailler » (3D, Maillage module — Features/threedCutLines): creates every
// maille at once from the cut lines — one maille per piece of the faces they
// cross (createMeshesFromCutLinesService). The button owns the busy state
// and the "no cut line" guard (ButtonCreateMeshes).
export default {
  key: "CREATE_MESHES",
  label: "Mailler",
  Icon: GridOnIcon,
  Button: ButtonCreateMeshes,
  editors: [EDITOR_3D],
  getState: (ctx) => getMeshingCommandDisabledState(ctx) ?? { enabled: true },
};
