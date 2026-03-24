import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";

import PortfolioTree from "./PortfolioTree";
import PortfolioEditorViewport from "./PortfolioEditorViewport";
import usePortfolioEditorShortcuts from "../hooks/usePortfolioEditorShortcuts";

export default function MainPortfolioEditor() {
  // shortcuts

  usePortfolioEditorShortcuts();

  // helpers

  const treeWidth = 260;

  // render

  return (
    <Box sx={{ width: 1, height: 1, display: "flex", position: "relative", overflow: "hidden" }}>
      {/* Left column: tree + export */}
      <LeftDrawerPanel width={treeWidth} viewerKey="PORTFOLIO">
        <BoxFlexVStretch sx={{ height: 1 }}>
          <BoxFlexVStretch sx={{ overflow: "auto" }}>
            <PortfolioTree />
          </BoxFlexVStretch>
        </BoxFlexVStretch>
      </LeftDrawerPanel>

      {/* Center: viewport */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <PortfolioEditorViewport />
      </Box>
    </Box>
  );
}
