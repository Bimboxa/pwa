import { useState, useRef } from "react";
import { useSelector } from "react-redux";

import { Box, Paper, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import SectionBaseMapsList from "Features/baseMaps/components/SectionBaseMapsList";
import IconButtonCreateBaseMapListing from "Features/baseMapEditor/components/IconButtonCreateBaseMapListing";
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
// bottom band with the "auto" height button, the attach icon,
// the collapse toggle and the resize handle), showing the base maps list
// like the attached "Fonds de plan" section does — without the "Visibilité
// auto" row: selecting a base map here always hides the others' image and
// annotations (in the BaseMaps module the header also gets the new-folder
// "+"). The base
// map placement commands live in the unified commands toolbar. Mounted by the
// editors right next to
// PopperMapListings (same gates); renders nothing while the list is
// attached. In 2D it is hidden — not unmounted, so it keeps its drag
// position and collapsed state — while a paste / subtract / drawing helper
// replaces the annotations popper.
// ---------------------------------------------------------------------------

const POPPER_WIDTH = 290;
// Default spot: right of the annotations popper (left 50 + its width + gap).
const DEFAULT_LEFT = 50 + 320 + 12;

export default function PopperBaseMapsList() {
  // strings

  const titleS = "Fonds de plan";

  // data

  // BaseMaps module legend without the annotations switch: the annotations
  // popper IS the base maps list (no annotations side) — nothing to detach.
  const detached = useSelector(
    (s) =>
      s.popperMapListings.baseMapsListDetached &&
      !(selectIsBaseMapsLegendPopper(s) && !s.baseMapEditor.showAnnotations)
  );
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

  const isBaseMapsModule = viewerKey === "BASE_MAPS";

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

        {isBaseMapsModule && <IconButtonCreateBaseMapListing />}
      </Box>

      {!collapsed && (
        <Box sx={{ overflow: "auto", flex: 1 }}>
          <SectionBaseMapsList hideAutoVisibility forceAutoVisibility />
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
        <IconButtonToggleDetached />
      </PanelFooter>
    </Paper>
  );
}
