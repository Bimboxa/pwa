import { Box } from "@mui/material";
import SouthEast from "@mui/icons-material/SouthEast";

// ---------------------------------------------------------------------------
// PanelResizeHandle — small diagonal arrow at the bottom-right corner of a
// floating panel (position: relative container): drag to resize
// (usePanelResize.handleResizeMouseDown), double-click to reset the size.
// ---------------------------------------------------------------------------

export default function PanelResizeHandle({ onMouseDown, onDoubleClick }) {
  return (
    <Box
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
      sx={{
        position: "absolute",
        bottom: 2,
        right: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        cursor: "nwse-resize",
        color: "panel.textLight",
        opacity: 0.6,
        zIndex: 1,
        "&:hover": { opacity: 1 },
      }}
    >
      <SouthEast sx={{ fontSize: 12 }} />
    </Box>
  );
}
