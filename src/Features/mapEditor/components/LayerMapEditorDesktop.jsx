import {Box} from "@mui/material";

import ButtonOpenListPanel from "Features/listPanel/components/ButtonOpenListPanel";
import ToolbarMapEditor from "./ToolbarMapEditor";
import SelectorMapInMapEditor from "Features/maps/components/SelectorMapInMapEditor";

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
          left: "50%",
          top: "8px",
          transform: "translateX(-50%)",
          zIndex: 1,
        }}
      >
        <SelectorMapInMapEditor />
      </Box>

      <Box
        sx={{
          position: "absolute",
          bottom: "8px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1,
        }}
      >
        <ToolbarMapEditor />
      </Box>
    </>
  );
}
