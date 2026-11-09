import { useCallback, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectImagesDisplayMode,
  selectImagesLinkStyle,
  selectPopperImagesCollapsed,
  setPopperImagesCollapsed,
} from "../popperImagesSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, Paper } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import ToggleImagesDisplayMode from "./ToggleImagesDisplayMode";
import IconButtonImagesSettingsMenu from "./IconButtonImagesSettingsMenu";
import GridImageAnnotations from "./GridImageAnnotations";
import ImagesLinksOverlay from "./ImagesLinksOverlay";
import DialogImageViewer from "Features/images/components/DialogImageViewer";
import PanelFooter from "Features/layout/components/PanelFooter";
import getPanelAutoMaxHeight from "Features/layout/utils/getPanelAutoMaxHeight";

import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import {
  buildImageAnnotationSelectionItem,
  selectSelectedImageAnnotationId,
} from "../utils/imageAnnotationSelection";

// ---------------------------------------------------------------------------
// PopperImages — floating panel of the photos (IMAGE annotations) displayed
// by the editor, anchored at the RIGHT of the editor box (left of the tools
// band, shifted when a right drawer is open). Same shell as the other
// poppers (draggable header, PanelFooter with the "auto" button, collapse and
// a bottom-LEFT resize handle). Header: "In situ | Ex situ" toggle + "…"
// settings menu. Body: 2-column grid of numbered tiles; a tile click selects
// the annotation (editor selection), the selected tile offers "Fullscreen"
// (DialogImageViewer). Ex situ + "Ligne": ImagesLinksOverlay draws the tile
// → anchor leaders. Mounted by the editors next to PopperMapListings (same
// gates — not mounted in capture mode, which renders its own tiles); renders
// nothing when the editor shows no photo.
// ---------------------------------------------------------------------------

const POPPER_WIDTH = 260;
const RIGHT_GAP = 12;

export default function PopperImages({
  images,
  indexById,
  anchorProjector,
  hostInvalidateKey,
}) {
  const dispatch = useDispatch();

  // data

  const displayMode = useSelector(selectImagesDisplayMode);
  const linkStyle = useSelector(selectImagesLinkStyle);
  const collapsed = useSelector(selectPopperImagesCollapsed);
  const selectedImageId = useSelector(selectSelectedImageAnnotationId);
  // The open right tool drawer slides over the editor: step aside.
  const rightDrawerWidth = useSelector((s) =>
    s.rightPanel.selectedMenuItemKey ? s.rightPanel.width : 0
  );

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();
  const paperRef = useRef(null);
  const gridRef = useRef(null);
  const tileElsRef = useRef(new Map());
  const [fullscreenImageId, setFullscreenImageId] = useState(null);
  const {
    size,
    isAutoHeight,
    handleResizeMouseDown,
    fitContent,
    reset: resetSize,
  } = usePanelResize({ paperRef, minWidth: 200, anchor: "right" });

  // helpers

  const registerEl = useCallback((id, el) => {
    if (el) tileElsRef.current.set(id, el);
    else tileElsRef.current.delete(id);
  }, []);
  const getTileRect = useCallback(
    (id) => tileElsRef.current.get(id)?.getBoundingClientRect() ?? null,
    []
  );
  const getGridRect = useCallback(
    () => gridRef.current?.getBoundingClientRect() ?? null,
    []
  );

  const linksActive =
    displayMode === "EX_SITU" && linkStyle === "LINE" && !collapsed;
  const invalidateKey = useMemo(
    () =>
      [
        position.x,
        position.y,
        size?.width,
        size?.height,
        collapsed,
        rightDrawerWidth,
        hostInvalidateKey,
      ].join("|"),
    [position, size, collapsed, rightDrawerWidth, hostInvalidateKey]
  );

  const fullscreenImage = useMemo(
    () => images?.find((a) => a.id === fullscreenImageId) ?? null,
    [images, fullscreenImageId]
  );

  // handlers

  function handleSelect(annotation) {
    const alreadySelected = annotation.id === selectedImageId;
    dispatch(
      setSelectedItem(
        alreadySelected ? null : buildImageAnnotationSelectionItem(annotation)
      )
    );
  }

  // render

  if (!images?.length) return null;

  return (
    <>
      <ImagesLinksOverlay
        active={linksActive}
        images={images}
        selectedImageId={selectedImageId}
        getTileRect={getTileRect}
        getGridRect={getGridRect}
        scrollEl={gridRef}
        observeEl={paperRef}
        anchorProjector={anchorProjector}
        invalidateKey={invalidateKey}
      />

      <Paper
        ref={paperRef}
        elevation={4}
        data-capture-hide
        sx={{
          position: "absolute",
          top: 50,
          right: RIGHT_GAP + rightDrawerWidth,
          zIndex: 10,
          width: size?.width ?? POPPER_WIDTH,
          ...(size && !collapsed
            ? {
                height: size.height,
                maxHeight: isAutoHeight
                  ? getPanelAutoMaxHeight({ top: "50px", offsetY: position.y })
                  : "calc(100% - 50px)",
              }
            : { maxHeight: "calc(100% - 50px - 80px)" }),
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 3,
          border: "1px solid",
          borderColor: "panel.border",
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDragging.current
            ? "right 0.15s ease"
            : "transform 0.1s ease-out, right 0.15s ease",
        }}
      >
        {/* Draggable header (whole bar except the controls) */}
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
          <ToggleImagesDisplayMode />
          <IconButtonImagesSettingsMenu />
        </Box>

        {!collapsed && (
          <Box ref={gridRef} sx={{ overflow: "auto", flex: 1 }}>
            <GridImageAnnotations
              images={images}
              indexById={indexById}
              selectedImageId={selectedImageId}
              onSelect={handleSelect}
              onFullscreen={(a) => setFullscreenImageId(a.id)}
              registerEl={registerEl}
            />
          </Box>
        )}

        <PanelFooter
          resizeCorner="bottom-left"
          onResizeMouseDown={handleResizeMouseDown}
          onResetSize={resetSize}
          onFitContent={fitContent}
          isAutoHeight={isAutoHeight}
          collapsed={collapsed}
          onToggleCollapsed={() =>
            dispatch(setPopperImagesCollapsed(!collapsed))
          }
        />
      </Paper>

      <DialogImageViewer
        open={Boolean(fullscreenImage)}
        onClose={() => setFullscreenImageId(null)}
        src={
          fullscreenImage?.image?.imageUrlClient ??
          fullscreenImage?.image?.thumbnail
        }
        title={fullscreenImage?.label || fullscreenImage?.image?.fileName || ""}
      />
    </>
  );
}
