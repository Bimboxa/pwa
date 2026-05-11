import { useDispatch, useSelector } from "react-redux";

import { setSelectedViewerKey } from "../viewersSlice";

import useViewers from "../hooks/useViewers";
import useLeftAreaHover from "Features/leftPanel/hooks/useLeftAreaHover";

import {
  Box,
  ButtonBase,
  Typography,
} from "@mui/material";

const MENU_WIDTH = 90;

export default function VerticalMenuViewers() {
  const dispatch = useDispatch();

  // data

  const viewers = useViewers();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);
  const visible = useSelector((s) => s.leftPanel.leftDrawerHovered);

  // hover

  const { onMouseEnter, onMouseLeave } = useLeftAreaHover();

  // handlers

  function handleClick(viewerKey) {
    dispatch(setSelectedViewerKey(viewerKey));
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

  // render - docked mode

  if (leftPanelDocked) {
    return (
      <Box
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
        width: MENU_WIDTH,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        bgcolor: "common.black",
        py: 1,
        overflowY: "auto",
        boxShadow: visible ? 4 : 0,
        transform: visible ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
      }}
    >
      {content}
    </Box>
  );
}
