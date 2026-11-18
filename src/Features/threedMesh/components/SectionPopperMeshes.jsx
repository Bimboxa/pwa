import { Box } from "@mui/material";

import useMeshes3dRows from "../hooks/useMeshes3dRows";

import SectionMeshes3dList from "./SectionMeshes3dList";
import SwitchMesh3dGroupByOrientation from "./SwitchMesh3dGroupByOrientation";
import SwitchMesh3dHideMeshes from "./SwitchMesh3dHideMeshes";

// "Maillage" side of the annotations popper (Maillage module, mailles drawer
// closed): the mailles list of the drawer with its "Masquer les mailles"
// and "Grouper par orientation" switches. The « Lignes de coupe » row stays on the "Annotations" side.
export default function SectionPopperMeshes() {
  // data

  const { rows } = useMeshes3dRows();

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flex: 1,
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          px: 1.5,
          py: 0.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <SwitchMesh3dHideMeshes />
        {rows.length > 0 && <SwitchMesh3dGroupByOrientation />}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <SectionMeshes3dList rows={rows} />
      </Box>
    </Box>
  );
}
