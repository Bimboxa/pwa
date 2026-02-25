import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import PortfolioTree from "./PortfolioTree";
import PortfolioEditorViewport from "./PortfolioEditorViewport";
import ButtonDownloadPortfolioPdf from "./ButtonDownloadPortfolioPdf";

export default function MainPortfolioEditor() {
  // helpers

  const treeWidth = 260;

  // render

  return (
    <Box sx={{ width: 1, height: 1, display: "flex" }}>
      {/* Left column: tree + export */}
      <Box
        sx={{
          width: treeWidth,
          minWidth: treeWidth,
          //borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: "background.default",
        }}
      >
        <BoxFlexVStretch sx={{ height: 1 }}>
          <BoxFlexVStretch sx={{ overflow: "auto" }}>
            <PortfolioTree />
          </BoxFlexVStretch>
          <ButtonDownloadPortfolioPdf />
        </BoxFlexVStretch>
      </Box>

      {/* Center: viewport */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <PortfolioEditorViewport />
      </Box>
    </Box>
  );
}
