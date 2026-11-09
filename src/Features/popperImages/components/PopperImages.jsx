import { useCallback, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectImagesDisplayMode,
  selectImagesLinkLine,
  selectImagesPhotosHidden,
  selectPopperImagesCollapsed,
  setImagesPhotosHidden,
  setPopperImagesCollapsed,
} from "../popperImagesSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, Paper, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import ToggleButtonImagesInSitu from "./ToggleButtonImagesInSitu";
import IconButtonImagesSettingsMenu from "./IconButtonImagesSettingsMenu";
import ButtonCountPill from "Features/popperMapListings/components/ButtonCountPill";
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
// a bottom-LEFT resize handle). Header: "Photos" title, count pill (toggles
// the photos off everywhere), "in situ" toggle button (in situ = the photos
// live in the editor only, the panel is its header) and the "…" settings
// menu. Body (ex situ): 2-column grid of numbered tiles; a tile click selects
// the annotation (editor selection), the selected tile offers "Fullscreen"
// (DialogImageViewer). Ex situ + "Ligne": ImagesLinksOverlay draws the tile
// → anchor leaders over the panel. Mounted by the editors next to PopperMapListings (same
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

  // strings

  const titleS = "Photos";
  const hidePhotosS = "Masquer les photos";
  const showPhotosS = "Afficher les photos";

  // data

  const displayMode = useSelector(selectImagesDisplayMode);
  const linkLine = useSelector(selectImagesLinkLine);
  const collapsed = useSelector(selectPopperImagesCollapsed);
  const photosHidden = useSelector(selectImagesPhotosHidden);
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

  // Ex situ: tiles body + footer. In situ: header only.
  const exSitu = displayMode === "EX_SITU";
  const bodyOpen = exSitu && !collapsed;
  const linksActive = exSitu && linkLine && !collapsed && !photosHidden;
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
          ...(size && bodyOpen
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
            borderBottom: bodyOpen ? "1px solid" : "none",
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
          <ButtonCountPill
            count={images.length}
            hidden={photosHidden}
            title={photosHidden ? showPhotosS : hidePhotosS}
            onClick={(e) => {
              e.stopPropagation();
              dispatch(setImagesPhotosHidden(!photosHidden));
            }}
          />
          <ToggleButtonImagesInSitu />
          <IconButtonImagesSettingsMenu />
        </Box>

        {bodyOpen && (
          <Box
            ref={gridRef}
            sx={{
              overflow: "auto",
              flex: 1,
              // Photos off: the tiles stay listed, greyed.
              opacity: photosHidden ? 0.4 : 1,
            }}
          >
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

        {exSitu && (
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
        )}
      </Paper>

      {/* Leaders drawn ABOVE the panel (ex situ + Ligne): each one ends on
          its tile, over the other tiles if need be; the svg never takes the
          mouse. */}
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
