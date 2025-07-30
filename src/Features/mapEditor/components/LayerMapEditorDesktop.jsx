import { Box } from "@mui/material";

import ButtonOpenListPanel from "Features/listPanel/components/ButtonOpenListPanel";
import ToolbarMapEditor from "./ToolbarMapEditor";
//import SelectorMapInMapEditor from "Features/baseMaps/components/SelectorMapInMapEditor";
import BlockPrintMode from "./BlockPrintMode";

export default function LayerMapEditorDesktop() {
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "8px",
          transform: "translateY(-50%)",
          zIndex: 1,
        }}
      >
        <ButtonOpenListPanel />
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: "50px",
          right: "8px",
          zIndex: 2,
        }}
      >
        <BlockPrintMode />
      </Box>

      <Box
        sx={{
          position: "absolute",
          bottom: "8px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10000,
        }}
      >
        <ToolbarMapEditor />
      </Box>
    </>
  );
}
