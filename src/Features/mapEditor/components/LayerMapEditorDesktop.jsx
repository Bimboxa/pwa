import {Box} from "@mui/material";

import ToolbarMapEditor from "./ToolbarMapEditor";

export default function LayerMapEditorDesktop() {
  return (
    <>
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
