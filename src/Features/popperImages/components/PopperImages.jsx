import { useCallback, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectImagesExSitu,
  selectImagesLinkLine,
  selectImagesPanelColumns,
  selectImagesPhotosHidden,
  selectPopperImagesCollapsed,
  setImagesPanelColumns,
  setPopperImagesCollapsed,
} from "../popperImagesSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import GridViewOutlined from "@mui/icons-material/GridViewOutlined";
import ViewAgendaOutlined from "@mui/icons-material/ViewAgendaOutlined";

import GridImageAnnotations from "./GridImageAnnotations";
import ImagesLinksOverlay from "./ImagesLinksOverlay";
import PopperImageAnchorHover from "./PopperImageAnchorHover";
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
// PopperImages — "overlay" (EX_SITU) display mode of the photos (IMAGE
// annotations) of the editor: a floating panel anchored at the RIGHT of the
// editor box (left of the tools band, shifted when a right drawer is open).
// Same shell as the other poppers (draggable header, PanelFooter with the
// "auto" button, collapse and a bottom-LEFT resize handle). Header: "Photos"
// title + the 1 / 2 columns toggle of the grid — the display mode, the count
// pill, the links and the options live in the bottom bar
// (SectionImagesBottomBarControls). Body: 1 or 2-column grid of numbered
// tiles; a tile click selects the annotation (editor selection), the
// selected tile offers "Fullscreen" (DialogImageViewer).
// ImagesLinksOverlay draws the tile → anchor leaders over the panel: all of
// them with "Ligne", the one of the selected photo otherwise. Mounted by the editors next to PopperMapListings (same gates — not
// mounted in capture mode, which renders its own tiles); renders nothing in
// the other display modes or when the editor shows no photo.
// ---------------------------------------------------------------------------

const POPPER_WIDTH = 260;
const RIGHT_GAP = 12;
const COLUMNS_OPTIONS = [
  { columns: 1, tooltip: "1 colonne", Icon: ViewAgendaOutlined },
  { columns: 2, tooltip: "2 colonnes", Icon: GridViewOutlined },
];

export default function PopperImages({
  images,
  indexById,
  anchorProjector,
  hostInvalidateKey,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Photos";

  // data

  const exSitu = useSelector(selectImagesExSitu);
  const linkLine = useSelector(selectImagesLinkLine);
  const collapsed = useSelector(selectPopperImagesCollapsed);
  const columns = useSelector(selectImagesPanelColumns);
  const photosHidden = useSelector(selectImagesPhotosHidden);
  const rawSelectedImageId = useSelector(selectSelectedImageAnnotationId);
  // Only a listed photo drives the tiles (a selected « Objet 2D » image is
  // not in `images` and must veil / highlight nothing).
  const selectedImageId = images?.some((a) => a.id === rawSelectedImageId)
    ? rawSelectedImageId
    : null;
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

  const bodyOpen = !collapsed;
  // "Ligne" off: the leader of the selected photo is still drawn.
  const linksActive =
    (linkLine || Boolean(selectedImageId)) && !collapsed && !photosHidden;
  const invalidateKey = useMemo(
    () =>
      [
        position.x,
        position.y,
        size?.width,
        size?.height,
        collapsed,
        columns,
        rightDrawerWidth,
        hostInvalidateKey,
      ].join("|"),
    [position, size, collapsed, columns, rightDrawerWidth, hostInvalidateKey]
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

  if (!exSitu || !images?.length) return null;

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
          {bodyOpen && (
            <Box
              onMouseDown={(e) => e.stopPropagation()}
              sx={{
                display: "flex",
                borderRadius: 1,
                overflow: "hidden",
                border: "1px solid",
                borderColor: "panel.border",
                cursor: "default",
              }}
            >
              {COLUMNS_OPTIONS.map(({ columns: value, tooltip, Icon }) => {
                const selected = value === columns;
                return (
                  <Tooltip key={value} title={tooltip}>
                    <Box
                      sx={{
                        display: "flex",
                        ...(selected && {
                          bgcolor: "action.active",
                          color: "common.white",
                        }),
                      }}
                    >
                      <IconButton
                        color={selected ? "inherit" : "default"}
                        onClick={() => dispatch(setImagesPanelColumns(value))}
                        sx={{ p: "2px", borderRadius: 0 }}
                      >
                        <Icon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          )}
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
              columns={columns}
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

      {/* Leaders drawn ABOVE the panel (ex situ + Ligne): each one ends on
          its tile, over the other tiles if need be; the svg never takes the
          mouse. */}
      <ImagesLinksOverlay
        active={linksActive}
        images={images}
        selectedImageId={selectedImageId}
        onlySelected={!linkLine}
        getTileRect={getTileRect}
        getGridRect={getGridRect}
        scrollEl={gridRef}
        observeEl={paperRef}
        anchorProjector={anchorProjector}
        invalidateKey={invalidateKey}
      />

      {/* Ex situ: hovering an anchor (dot / numbered badge) in the editor
          shows its photo. */}
      <PopperImageAnchorHover
        active={!photosHidden && !fullscreenImage}
        images={images}
        indexById={indexById}
        anchorProjector={anchorProjector}
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
