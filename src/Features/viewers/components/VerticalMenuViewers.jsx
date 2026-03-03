import { useDispatch, useSelector } from "react-redux";

import { setSelectedViewerKey } from "../viewersSlice";

import useViewers from "../hooks/useViewers";

import {
  Box,
  ButtonBase,
  Typography,
} from "@mui/material";

export default function VerticalMenuViewers() {
  const dispatch = useDispatch();

  // data

  const viewers = useViewers();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // handlers

  function handleClick(viewerKey) {
    dispatch(setSelectedViewerKey(viewerKey));
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: "common.black",
        py: 1,
        width: 90,
        minWidth: 90,
        overflowY: "auto",
      }}
    >
      {viewers.map((viewer) => {
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
      })}
    </Box>
  );
}
