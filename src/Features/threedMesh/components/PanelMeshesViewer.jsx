import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";

import useMeshes3dRows from "../hooks/useMeshes3dRows";

import SectionMeshes3dList from "./SectionMeshes3dList";
import SwitchMesh3dGroupByOrientation from "./SwitchMesh3dGroupByOrientation";

// Drawer content of the MESHES viewer (left panel next to the 3D editor):
// the mailles list. The module settings live in the module properties panel
// (PanelPropertiesMeshesModule), the mailles export in the Export tool of the
// right panel (PanelPrint).
export default function PanelMeshesViewer() {
  // data

  const { rows } = useMeshes3dRows();

  // render

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      {/* Header */}
      <LeftDrawerPanelHeader title="Mailles" />

      {/* Content */}
      <BoxFlexVStretch sx={{ minHeight: 0 }}>
        {rows.length > 0 && (
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <SwitchMesh3dGroupByOrientation />
          </Box>
        )}
        <BoxFlexVStretch sx={{ overflow: "auto" }}>
          <SectionMeshes3dList rows={rows} />
        </BoxFlexVStretch>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
