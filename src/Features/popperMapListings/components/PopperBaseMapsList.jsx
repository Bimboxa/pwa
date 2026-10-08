import { useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Tune from "@mui/icons-material/Tune";

import SectionBaseMapsList from "Features/baseMaps/components/SectionBaseMapsList";
import IconButtonToggleDetached from "./IconButtonToggleDetached";
import PanelFooter from "Features/layout/components/PanelFooter";
import getPanelAutoMaxHeight from "Features/layout/utils/getPanelAutoMaxHeight";

import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import selectIsBaseMapsLegendPopper from "Features/popperMapListings/utils/selectIsBaseMapsLegendPopper";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// ---------------------------------------------------------------------------
// PopperBaseMapsList — the base maps list detached from PopperMapListings
// ("Détacher la liste" icon of the bottom band of its "Fonds de plan" side):
// a second floating panel with the very same structure (draggable header,
// properties, bottom band with the "auto" height button, the attach icon,
// the collapse toggle and the resize handle), showing the base maps only. Mounted by the
// editors right next to PopperMapListings (same gates);
// renders nothing while the list is attached. In 2D it is hidden — not
// unmounted, so it keeps its drag position and collapsed state — while a
// paste / subtract / drawing helper replaces the annotations popper.
// ---------------------------------------------------------------------------

const POPPER_WIDTH = 290;
// Default spot: right of the annotations popper (left 50 + its width + gap).
const DEFAULT_LEFT = 50 + 320 + 12;

export default function PopperBaseMapsList() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Fonds de plan";
  const propertiesS = "Propriétés";

  // data

  // BaseMaps module legend without the annotations switch: the annotations
  // popper IS the base maps list (no annotations side) — nothing to detach.
  const detached = useSelector(
    (s) =>
      s.popperMapListings.baseMapsListDetached &&
      !(selectIsBaseMapsLegendPopper(s) && !s.baseMapEditor.showAnnotations)
  );
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  // Same helper chain as PopperMapListings (2D only).
  const helperActive = useSelector(
    (s) =>
      !isThreedFamilyViewerKey(s.viewers.selectedViewerKey) &&
      !(
        s.viewers.selectedViewerKey === "BASE_MAPS" &&
        isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
      ) &&
      Boolean(
        s.mapEditor.pasteClipboard ||
        selectSubtractPickAnnotationId(s) ||
        s.mapEditor.enabledDrawingMode
      )
  );

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

  // helpers

  // Same rule as the annotations popper: no properties panel in the Viewer
  // (read-only legend) and BaseMaps modules.
  const showProperties = viewerKey !== "THREED" && viewerKey !== "BASE_MAPS";

  // handlers

  function handleOpenProperties(e) {
    e.stopPropagation();
    dispatch(
      setSelectedItem({ id: selectedScopeId, type: "POPPER_BASE_MAPS" })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  // render

  if (!detached) return null;

  return (
    <Paper
      ref={paperRef}
      elevation={4}
      data-capture-hide
      sx={{
        position: "absolute",
        top: 50,
        left: DEFAULT_LEFT,
        zIndex: 10,
        width: size?.width ?? POPPER_WIDTH,
        ...(size && !collapsed
          ? {
              height: size.height,
              // "auto" height: the bottom stays above the bottom reserve.
              maxHeight: isAutoHeight
                ? getPanelAutoMaxHeight({ top: "50px", offsetY: position.y })
                : "calc(100% - 50px)",
            }
          : { maxHeight: "calc(100% - 50px - 80px)" }),
        display: helperActive ? "none" : "flex",
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

        {showProperties && (
          <Tooltip title={propertiesS}>
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleOpenProperties}
              sx={{ color: "panel.textLight", p: 0.25, cursor: "pointer" }}
            >
              <Tune sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {!collapsed && (
        <Box sx={{ overflow: "auto", flex: 1 }}>
          <SectionBaseMapsList />
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
        <IconButtonToggleDetached target="BASE_MAPS" />
      </PanelFooter>
    </Paper>
  );
}
