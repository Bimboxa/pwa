import { Box } from "@mui/material";

import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";

import PanelPortfolios from "./PanelPortfolios";
import PortfolioEditorViewport from "./PortfolioEditorViewport";
import usePortfolioEditorShortcuts from "../hooks/usePortfolioEditorShortcuts";

export default function MainPortfolioEditor() {
  // shortcuts

  usePortfolioEditorShortcuts();

  // helpers

  const treeWidth = 260;

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
      {/* Left column: tree + export */}
      <LeftDrawerPanel width={treeWidth} viewerKey="PORTFOLIO">
        <PanelPortfolios />
      </LeftDrawerPanel>

      {/* Center: viewport */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <PortfolioEditorViewport />
      </Box>
    </Box>
  );
}
