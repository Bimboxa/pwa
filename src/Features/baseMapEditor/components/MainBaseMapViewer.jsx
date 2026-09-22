import { Box } from "@mui/material";

import MainMapEditorV3 from "Features/mapEditor/components/MainMapEditorV3";

export default function MainBaseMapViewer() {
  // render

  return (
    // The base maps tree is mounted by SectionViewer as an in-flow sibling of
    // the editors area (it serves both the 2D and the 3D editor of the module).
    // The "create a base map" section is hosted by SectionViewer too
    // (LayerCreateBaseMap), as an overlay of whichever editor is displayed.
    <Box sx={{ width: 1, height: 1, display: "flex", position: "relative", overflow: "hidden" }}>
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <MainMapEditorV3 forViewerKey="BASE_MAPS" />
      </Box>
    </Box>
  );
}
