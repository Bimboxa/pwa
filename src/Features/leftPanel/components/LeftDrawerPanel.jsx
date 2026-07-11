import { useSelector } from "react-redux";

import useLeftAreaHover from "../hooks/useLeftAreaHover";

import { Box } from "@mui/material";

export default function LeftDrawerPanel({ children, width = 260, viewerKey }) {
  // data

  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);
  const menuHovered = useSelector((s) => s.leftPanel.leftDrawerHovered);
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // helpers

  const isActiveViewer = !viewerKey || selectedViewerKey === viewerKey;
  const visible = isActiveViewer && menuHovered;

  // hover

  const { onMouseEnter, onMouseLeave } = useLeftAreaHover();

  // render - docked mode

  if (leftPanelDocked) {
    return (
      <Box
        sx={{
          width,
          minWidth: width,
          bgcolor: "background.default",
        }}
      >
        {children}
      </Box>
    );
  }

  // render - drawer mode

  return (
    <Box
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width,
        zIndex: 20,
        bgcolor: "background.default",
        boxShadow: visible ? 4 : 0,
        overflow: "auto",
        transform: visible ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
      }}
    >
      {children}
    </Box>
  );
}
