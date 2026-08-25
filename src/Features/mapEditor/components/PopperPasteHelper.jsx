import { useSelector } from "react-redux";

import { Box, Paper, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import SectionPasteHelperContent from "./SectionPasteHelperContent";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";

// ---------------------------------------------------------------------------
// PopperPasteHelper — floating panel shown while a copy/paste is active
// ---------------------------------------------------------------------------

export default function PopperPasteHelper() {
  // strings

  const titleS = "Mode copier/coller";

  // data

  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const copiedCount = pasteClipboard?.items?.length ?? 0;

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // render

  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        width: "fit-content",
        maxWidth: 400,
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
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
          py: 0.75,
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
          sx={{ fontWeight: 500, color: "panel.textMuted" }}
        >
          {titleS}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography
          variant="caption"
          sx={{
            color: "panel.textLight",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {copiedCount > 1 ? `${copiedCount} annotations` : "1 annotation"}
        </Typography>
      </Box>

      <SectionPasteHelperContent />
    </Paper>
  );
}
