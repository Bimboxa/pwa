import { Box } from "@mui/material";

import PortfolioTree from "./PortfolioTree";
import PortfolioEditorViewport from "./PortfolioEditorViewport";

export default function MainPortfolioEditor() {
  // helpers

  const treeWidth = 260;

  // render

  return (
    <Box sx={{ width: 1, height: 1, display: "flex" }}>
      {/* Left column: tree */}
      <Box
        sx={{
          width: treeWidth,
          minWidth: treeWidth,
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
          overflow: "auto",
        }}
      >
        <PortfolioTree />
      </Box>

      {/* Center: viewport */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <PortfolioEditorViewport />
      </Box>
    </Box>
  );
}
