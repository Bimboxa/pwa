import { useState, useRef } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import UnfoldLess from "@mui/icons-material/UnfoldLess";
import UnfoldMore from "@mui/icons-material/UnfoldMore";

import SectionPopperDrawingTools from "./SectionPopperDrawingTools";
import IconButtonToggleDetached from "./IconButtonToggleDetached";
import PanelResizeHandle from "Features/layout/components/PanelResizeHandle";

import db from "App/db/db";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import useTemplatelessCount from "../hooks/useTemplatelessCount";
import selectShowDrawingTools from "../utils/selectShowDrawingTools";
import selectEffectiveInteractionMode from "../utils/selectEffectiveInteractionMode";
import selectActiveThreedTool from "Features/threedDrawing/utils/selectActiveThreedTool";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import canLocateBusinessObjects from "Features/businessObjects/utils/canLocateBusinessObjects";

// ---------------------------------------------------------------------------
// PopperDrawingTools — the drawing tools ("Commandes") detached from
// PopperMapListings ("Détacher les commandes" icon of its "Commandes" title
// row — detached by default): a floating panel with the same structure
// (draggable header, attach icon, collapse, resize handle) listing the tool
// rows (SectionPopperDrawingTools). Mounted by both editors (2D and 3D) right
// next to PopperMapListings, under it by default (2/3 - 1/3 of the available
// height); renders nothing while the tools are attached or do not apply
// (selectShowDrawingTools). Hidden — not unmounted, so it keeps its drag
// position, size and collapsed state — while a paste / subtract / drawing
// helper replaces the annotations popper (same chain as PopperMapListings:
// an armed draw, or an armed threedEditor tool in the Dessin module's 3D
// editor).
// ---------------------------------------------------------------------------

const POPPER_WIDTH = 320;
// Default spot: under the annotations popper (top 50 + its 2/3 + gap).
const DEFAULT_TOP = "calc(50px + (100% - 130px - 12px) * 2 / 3 + 12px)";
const DEFAULT_MAX_HEIGHT = "calc((100% - 130px - 12px) / 3)";

export default function PopperDrawingTools() {
  // strings

  const titleS = "Commandes";
  const collapseS = "Replier";
  const expandS = "Déplier";

  // data

  const detached = useSelector((s) => s.popperMapListings.toolsDetached);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveInteractionMode = useSelector(selectEffectiveInteractionMode);
  const isZonesViewer = viewerKey === "ZONES";
  // Displayed editor (the Dessin module toggled to 3D): picks the tools
  // offered, like PopperMapListings.
  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const templatelessCount = useTemplatelessCount();

  // Business-objects modules: same gates as PopperMapListings (no tools in
  // locate mode, edit-only tools without an active object).
  const isBusinessObjectsModule = isBusinessObjectsModuleKey(viewerKey);
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects?.activeBusinessObjectId ?? null
  );
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );
  const activeBusinessObject = useLiveQuery(async () => {
    if (!isBusinessObjectsModule || !activeBusinessObjectId) return null;
    const o = await db.businessObjects.get(activeBusinessObjectId);
    return o && !o.deletedAt ? o : null;
  }, [
    isBusinessObjectsModule,
    activeBusinessObjectId,
    businessObjectsUpdatedAt,
  ]);
  const activeBusinessObjectListing = useSelector((s) =>
    activeBusinessObject?.listingId
      ? (s.listings.listingsById?.[activeBusinessObject.listingId] ?? null)
      : null
  );
  const isLocateBusinessObjectMode =
    isBusinessObjectsModule &&
    Boolean(activeBusinessObject) &&
    canLocateBusinessObjects(activeBusinessObjectListing);
  const isBusinessObjectsModuleNoObject =
    isBusinessObjectsModule && !activeBusinessObject;

  const showDrawingTools = selectShowDrawingTools({
    effectiveInteractionMode,
    isZonesViewer,
    isBusinessObjectsModuleNoObject,
    isLocateBusinessObjectMode,
  });

  // Helper chain of PopperMapListings: a helper replaces the annotations
  // popper in the drawing modules (off in the 3D-family modules and in the
  // BaseMaps module displaying its 3D editor).
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
        s.mapEditor.enabledDrawingMode ||
        selectActiveThreedTool(s)
      )
  );

  // state

  const [collapsed, setCollapsed] = useState(false);
  const { position, isDragging, handleMouseDown } = usePanelDrag();
  const paperRef = useRef(null);
  const {
    size,
    handleResizeMouseDown,
    reset: resetSize,
  } = usePanelResize({ paperRef });

  // render

  if (!detached || !showDrawingTools) return null;

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
          ? { height: size.height, maxHeight: "calc(100% - 50px)" }
          : { maxHeight: DEFAULT_MAX_HEIGHT }),
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

        <IconButtonToggleDetached target="TOOLS" variant="header" />

        <Tooltip title={collapsed ? expandS : collapseS}>
          <IconButton
            size="small"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => !c);
            }}
            sx={{ color: "panel.textLight", p: 0.25, cursor: "pointer" }}
          >
            {collapsed ? (
              <UnfoldMore sx={{ fontSize: 16 }} />
            ) : (
              <UnfoldLess sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {!collapsed && (
        <Box sx={{ overflow: "auto", flex: 1 }}>
          <SectionPopperDrawingTools
            templatelessCount={templatelessCount}
            isThreedEditor={isThreedEditor}
            viewerKey={viewerKey}
          />
        </Box>
      )}

      {!collapsed && (
        <PanelResizeHandle
          onMouseDown={handleResizeMouseDown}
          onDoubleClick={resetSize}
        />
      )}
    </Paper>
  );
}
