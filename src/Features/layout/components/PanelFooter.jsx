import { Box, Tooltip } from "@mui/material";
import UnfoldLess from "@mui/icons-material/UnfoldLess";
import UnfoldMore from "@mui/icons-material/UnfoldMore";

import PanelResizeHandle from "./PanelResizeHandle";

// ---------------------------------------------------------------------------
// PanelFooter — dedicated bottom band of a floating panel (PopperMapListings,
// PopperDrawingTools, PopperBaseMapsList), rendered collapsed or not. From
// left to right: the "auto" button (usePanelResize.fitContent: the panel's
// height goes back to CSS auto and follows its content, capped by the
// available height, until the next manual resize), the optional actions
// passed as children (the detach / attach icon), the collapse / expand
// toggle, and the resize handle in a reserved right margin (no overlap with
// the panel's last row any more). Collapsed, only the actions and the toggle
// remain — the latter with an explicit "Déplier" label (nothing to fit or
// resize).
// ---------------------------------------------------------------------------

export default function PanelFooter({
  onResizeMouseDown,
  onResetSize,
  onFitContent,
  isAutoHeight = false,
  collapsed = false,
  onToggleCollapsed,
  children,
}) {
  // strings

  const autoS = "auto";
  const fitContentS = "Ajuster la hauteur au contenu";
  const collapseS = "Replier";
  const expandS = "Déplier";

  // render

  return (
    <Box
      sx={{
        position: "relative",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 0.5,
        pl: 1,
        // Reserved margin for the resize handle (16px + 2px + gap).
        pr: collapsed ? 1 : 3,
        minHeight: 22,
        borderTop: "1px solid",
        borderColor: "panel.border",
        bgcolor: "panel.headerBg",
      }}
    >
      {!collapsed && (
        <Tooltip title={fitContentS} arrow placement="top">
          <Box
            component="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onFitContent?.();
            }}
            sx={{
              border: "none",
              bgcolor: "transparent",
              p: 0,
              px: 0.5,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              lineHeight: 1,
              fontWeight: isAutoHeight ? 600 : 400,
              color: isAutoHeight ? "panel.textMuted" : "panel.textLight",
              "&:hover": { color: "panel.textMuted" },
            }}
          >
            {autoS}
          </Box>
        </Tooltip>
      )}

      {children}

      {onToggleCollapsed && (
        <Tooltip title={collapsed ? expandS : collapseS} arrow placement="top">
          <Box
            component="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapsed();
            }}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              border: "none",
              bgcolor: "transparent",
              p: 0.25,
              px: collapsed ? 0.5 : 0.25,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              lineHeight: 1,
              color: "panel.textLight",
              "&:hover": { color: "panel.textMuted" },
            }}
          >
            {collapsed ? (
              <>
                {expandS}
                <UnfoldMore sx={{ fontSize: 14 }} />
              </>
            ) : (
              <UnfoldLess sx={{ fontSize: 14 }} />
            )}
          </Box>
        </Tooltip>
      )}

      {!collapsed && (
        <PanelResizeHandle
          onMouseDown={onResizeMouseDown}
          onDoubleClick={onResetSize}
        />
      )}
    </Box>
  );
}
