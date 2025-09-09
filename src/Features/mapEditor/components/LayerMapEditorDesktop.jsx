import { Box } from "@mui/material";

import ButtonOpenListPanel from "Features/listPanel/components/ButtonOpenListPanel";
import ToolbarMapEditorContainer from "./ToolbarMapEditorContainer";
//import SelectorMapInMapEditor from "Features/baseMaps/components/SelectorMapInMapEditor";
import BlockPrintMode from "./BlockPrintMode";
import BlockSaveBaseMapViewInEditor from "Features/baseMapViews/components/BlockSaveBaseMapViewInEditor";
import ButtonSelectorBaseMapInMapEditor from "Features/baseMaps/components/ButtonSelectorBaseMapInMapEditor";
import LayerCreateLocatedEntity from "./LayerCreateLocatedEntity";

export default function LayerMapEditorDesktop() {
  return (
    <>
      {/* <LayerCreateLocatedEntity /> */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: "16px",
          transform: "translateX(-50%)",
          zIndex: 10000,
        }}
      >
        <ButtonSelectorBaseMapInMapEditor />
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "8px",
          transform: "translateY(-50%)",
          zIndex: 10000,
        }}
      >
        <ButtonOpenListPanel />
      </Box>

      {/* <Box
        sx={{
          position: "absolute",
          //top: "64px",
          bottom: "8px",
          right: "8px",
          //left: "50%",
          //transform: "translateX(-50%)",
          zIndex: 2,
        }}
      >
        <BlockSaveBaseMapViewInEditor />
      </Box> */}

      <Box
        sx={{
          position: "absolute",
          bottom: "8px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10000,
        }}
      >
        <ToolbarMapEditorContainer />
      </Box>
    </>
  );
}
