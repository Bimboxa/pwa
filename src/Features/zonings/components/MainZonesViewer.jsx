import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import MainMapEditorV3 from "Features/mapEditor/components/MainMapEditorV3";
import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";

import ZoningsTree from "./ZoningsTree";

export default function MainZonesViewer() {
  // helpers

  const treeWidth = 300;

  // NOTE: no unmount cleanup here — this viewer unmounts on the 2D→3D editor
  // toggle (T) while the module stays selected. The zone solo/selection is
  // cleared by the zoningsSlice extraReducer on setSelectedViewerKey instead.

  // render

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left column: zonings tree */}
      <LeftDrawerPanel width={treeWidth} viewerKey="ZONES">
        <BoxFlexVStretch sx={{ height: 1 }}>
          <BoxFlexVStretch sx={{ overflow: "auto" }}>
            <ZoningsTree />
          </BoxFlexVStretch>
        </BoxFlexVStretch>
      </LeftDrawerPanel>

      {/* Center: map editor */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <MainMapEditorV3 forViewerKey="ZONES" />
      </Box>
    </Box>
  );
}
