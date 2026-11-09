import { Box } from "@mui/material";
import SouthEast from "@mui/icons-material/SouthEast";
import SouthWest from "@mui/icons-material/SouthWest";

// ---------------------------------------------------------------------------
// PanelResizeHandle — small diagonal arrow at a bottom corner of a floating
// panel, rendered in the reserved margin of its bottom band (PanelFooter,
// position: relative): drag to resize (usePanelResize.handleResizeMouseDown),
// double-click to reset the size. `corner` = "bottom-right" (default, panels
// anchored to the left) or "bottom-left" (panels anchored to the right —
// usePanelResize({ anchor: "right" })).
// ---------------------------------------------------------------------------

export default function PanelResizeHandle({
  onMouseDown,
  onDoubleClick,
  corner = "bottom-right",
}) {
  const left = corner === "bottom-left";
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
        ...(left ? { left: 2 } : { right: 2 }),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        cursor: left ? "nesw-resize" : "nwse-resize",
        color: "panel.textLight",
        opacity: 0.6,
        zIndex: 1,
        "&:hover": { opacity: 1 },
      }}
    >
      {left ? (
        <SouthWest sx={{ fontSize: 12 }} />
      ) : (
        <SouthEast sx={{ fontSize: 12 }} />
      )}
    </Box>
  );
}
