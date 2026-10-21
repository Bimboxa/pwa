import { useDispatch } from "react-redux";

import { clearDetection } from "../duplicatesDetectionSlice";

import { Box, IconButton, Paper, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Close from "@mui/icons-material/Close";

import SectionDuplicatesHelperContent from "./SectionDuplicatesHelperContent";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";

// ---------------------------------------------------------------------------
// PopperDuplicatesHelper — floating « Détection des doublons » helper of the
// drawer mode (left panel not docked), returned by PopperMapListings' helper
// chain like PopperPasteHelper. Draggable by its header.
// ---------------------------------------------------------------------------

export default function PopperDuplicatesHelper() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Détection des doublons";

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // handlers

  function handleClose() {
    dispatch(clearDetection());
  }

  // render

  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        width: 360,
        maxWidth: 400,
        maxHeight: "calc(100% - 32px)",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      }}
    >
      {/* Drag handle header */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          bgcolor: "panel.headerBg",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <DragIndicatorIcon fontSize="small" sx={{ color: "panel.textLight" }} />
        <Typography
          variant="body2"
          sx={{ flex: 1, fontWeight: 500, color: "panel.textMuted" }}
        >
          {titleS}
        </Typography>
        <ShortcutBadge>Esc</ShortcutBadge>
        <IconButton
          size="small"
          onClick={handleClose}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{ color: "panel.textMuted" }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <SectionDuplicatesHelperContent />
      </Box>
    </Paper>
  );
}
