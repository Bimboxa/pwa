import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";

import PanelPortfolios from "./PanelPortfolios";
import PortfolioEditorViewport from "./PortfolioEditorViewport";
import PopperPortfolioManager from "./PopperPortfolioManager";
import usePortfolioEditorShortcuts from "../hooks/usePortfolioEditorShortcuts";

export default function MainPortfolioEditor() {
  // shortcuts

  usePortfolioEditorShortcuts();

  // data

  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);

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
        {/* Folded panel: the floating manager takes over the tree's role
            (current portfolio, selector, pages). */}
        {!leftPanelDocked && <PopperPortfolioManager />}
      </Box>
    </Box>
  );
}
