import { useState, useRef } from "react";
import { useSelector } from "react-redux";

import { Box, Paper, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import IconButtonToggleDetached from "./IconButtonToggleDetached";
import { ListBaseMapsCommands } from "Features/threedBaseMapMove/components/SectionBaseMapsTools";
import PanelFooter from "Features/layout/components/PanelFooter";
import getPanelAutoMaxHeight from "Features/layout/utils/getPanelAutoMaxHeight";

import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// ---------------------------------------------------------------------------
// PopperDrawingTools — the "Commandes" of the BaseMaps module detached from
// PopperMapListings ("Détacher les commandes" icon of its bottom band —
// detached by default): a floating panel with the same structure (draggable
// header, bottom band with the "auto" height button, the attach icon, the
// collapse toggle and the resize handle) listing the base maps placement
// tools Déplacer / Tourner (ListBaseMapsCommands), 3D editor only, attached
// as the "Commandes" section under the base maps list (SectionBaseMapsTools).
// The annotation drawing commands of the other modules live in the unified
// commands toolbar (Features/commandsToolbar).
// Mounted by both editors (2D and 3D) right next to PopperMapListings, under
// it by default (2/3 - 1/3 of the available height); renders nothing while
// the commands are attached or do not apply (keeps its drag position, size
// and collapsed state).
// ---------------------------------------------------------------------------

const POPPER_WIDTH = 320;
// Default spot: under the annotations popper (top 50 + its 2/3 + gap).
const DEFAULT_TOP = "calc(50px + (100% - 130px - 12px) * 2 / 3 + 12px)";
const DEFAULT_MAX_HEIGHT = "calc((100% - 130px - 12px) / 3)";

export default function PopperDrawingTools() {
  // strings

  const titleS = "Commandes";

  // data

  const detached = useSelector((s) => s.popperMapListings.toolsDetached);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  // BaseMaps module: the module's commands are the base maps placement
  // tools, 3D editor only (nothing in 2D, like SectionBaseMapsTools).
  const showCommands = viewerKey === "BASE_MAPS" && isThreedEditor;

  // state

  const [collapsed, setCollapsed] = useState(false);
  const { position, isDragging, handleMouseDown } = usePanelDrag();
  const paperRef = useRef(null);
  const {
    size,
    isAutoHeight,
    handleResizeMouseDown,
    fitContent,
    reset: resetSize,
  } = usePanelResize({ paperRef });

  // render

  if (!detached || !showCommands) return null;

  return (
    <Paper
      ref={paperRef}
      elevation={4}
      data-capture-hide
      sx={{
        position: "absolute",
        top: DEFAULT_TOP,
        left: 50,
        zIndex: 10,
        width: size?.width ?? POPPER_WIDTH,
        ...(size && !collapsed
          ? {
              height: size.height,
              // "auto" height: the bottom stays above the bottom reserve.
              maxHeight: isAutoHeight
                ? getPanelAutoMaxHeight({
                    top: DEFAULT_TOP,
                    offsetY: position.y,
                  })
                : "calc(100% - 50px)",
            }
          : { maxHeight: DEFAULT_MAX_HEIGHT }),
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 3,
        border: "1px solid",
        borderColor: "panel.border",
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      }}
    >
      {/* Draggable header (whole bar except action buttons on the right) */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 0.25,
          pr: 1,
          py: 0.75,
          bgcolor: "panel.headerBg",
          borderBottom: collapsed ? "none" : "1px solid",
          borderColor: "panel.border",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <DragIndicatorIcon
            fontSize="small"
            sx={{ color: "panel.textLight" }}
          />
        </Box>

        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "panel.textPrimary", flex: 1 }}
        >
          {titleS}
        </Typography>
      </Box>

      {!collapsed && (
        <Box sx={{ overflow: "auto", flex: 1 }}>
          <ListBaseMapsCommands />
        </Box>
      )}

      <PanelFooter
        onResizeMouseDown={handleResizeMouseDown}
        onResetSize={resetSize}
        onFitContent={fitContent}
        isAutoHeight={isAutoHeight}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      >
        <IconButtonToggleDetached target="TOOLS" />
      </PanelFooter>
    </Paper>
  );
}
