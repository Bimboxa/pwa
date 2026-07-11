import { useSelector } from "react-redux";

import useSwitchViewer from "../hooks/useSwitchViewer";

import useViewers from "../hooks/useViewers";
import useLeftAreaHover from "Features/leftPanel/hooks/useLeftAreaHover";

import {
  Box,
  ButtonBase,
  Typography,
} from "@mui/material";

const MENU_WIDTH = 90;

export default function VerticalMenuViewers() {
  const switchViewer = useSwitchViewer();

  // data

  const viewers = useViewers();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);

  // hover

  const { onMouseEnter, onMouseLeave } = useLeftAreaHover();

  // handlers

  function handleClick(viewerKey) {
    switchViewer(viewerKey);
  }

  // render - shared content

  const content = viewers.map((viewer) => {
    const isSelected = viewer.key === selectedViewerKey;

    return (
      <ButtonBase
        key={viewer.key}
        onClick={() => handleClick(viewer.key)}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          py: 1.5,
          px: 0.5,
          color: "common.white",
          opacity: isSelected ? 1 : 0.6,
          bgcolor: isSelected ? "rgba(255,255,255,0.12)" : "transparent",
          borderLeft: isSelected ? "3px solid white" : "3px solid transparent",
          transition: "all 0.15s ease",
          "&:hover": {
            opacity: 1,
            bgcolor: "rgba(255,255,255,0.08)",
          },
        }}
      >
        <Box sx={{ fontSize: 24, display: "flex", alignItems: "center" }}>
          {viewer.icon}
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: "common.white",
            fontSize: "0.65rem",
            lineHeight: 1.2,
            textAlign: "center",
            maxWidth: 80,
          }}
        >
          {viewer.shortLabel}
        </Typography>
      </ButtonBase>
    );
  });

  // render - always-visible bar; hovering it reveals the drawer when undocked

  return (
    <Box
      onMouseEnter={leftPanelDocked ? undefined : onMouseEnter}
      onMouseLeave={leftPanelDocked ? undefined : onMouseLeave}
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: "common.black",
        py: 1,
        width: MENU_WIDTH,
        minWidth: MENU_WIDTH,
        overflowY: "auto",
      }}
    >
      {content}
    </Box>
  );
}
