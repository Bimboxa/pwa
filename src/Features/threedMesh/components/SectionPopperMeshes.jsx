import { Box } from "@mui/material";

import useMeshes3dRows from "../hooks/useMeshes3dRows";

import SectionMeshes3dList from "./SectionMeshes3dList";
import SwitchMesh3dGroupByOrientation from "./SwitchMesh3dGroupByOrientation";

// "Maillage" side of the annotations popper (Maillage module, mailles drawer
// closed): the mailles list of the drawer with its "Grouper par orientation"
// switch. The « Lignes de coupe » row stays on the "Annotations" side.
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
      {rows.length > 0 && (
        <Box
          sx={{
            flexShrink: 0,
            px: 1.5,
            py: 0.5,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <SwitchMesh3dGroupByOrientation />
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <SectionMeshes3dList rows={rows} />
      </Box>
    </Box>
  );
}
