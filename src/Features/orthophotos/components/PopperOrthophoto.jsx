import { useRef, useSyncExternalStore } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedOrthophotoId,
  setOrthophotoOverlayOpacity,
  setOrthophotoPopperMode,
} from "../orthophotosSlice";

import {
  Box,
  IconButton,
  Paper,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";

import PanelFooter from "Features/layout/components/PanelFooter";
import getPanelAutoMaxHeight from "Features/layout/utils/getPanelAutoMaxHeight";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import usePhotoImageUrl from "Features/photos/hooks/usePhotoImageUrl";

import {
  getHoveredOrthophotoIdsKey,
  subscribeHoveredOrthophotoIds,
} from "../utils/orthophotoHoverStore";
import { getOrthophotoHoverColor } from "../utils/orthophotoHoverStyle";

const POPPER_WIDTH = 420;
const RIGHT_GAP = 12;
const TOP = 50;

// Grid of the original photos of the ACTIVE orthophotos (not unchecked in the
// tool), with their number. While the cursor hovers the base map, the photos
// rebuilding the hovered spot stay as they are — framed in the colour of
// their outline on the plan — and the others turn grey and translucent.
// Click: selects the photo and goes back to the « Sélection » view.
function GridSourcePhotos({ orthophotos, selectedOrthophotoId, onSelect }) {
  const theme = useTheme();

  // strings

  const emptyS = "Aucune photo d'origine active.";

  // data

  const hoveredKey = useSyncExternalStore(
    subscribeHoveredOrthophotoIds,
    getHoveredOrthophotoIdsKey
  );

  // helpers

  const hoveredIds = hoveredKey ? new Set(hoveredKey.split("|")) : null;
  // same colour rank as the outlines of LayerOrthophotoStations
  const items = orthophotos
    .map((orthophoto, index) => ({ orthophoto, index }))
    .filter(
      ({ orthophoto }) =>
        !orthophoto.isExcluded && orthophoto.sourceImage?.thumbnail
    );

  // render

  if (items.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ p: 2 }}>
        {emptyS}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
        gap: 0.75,
        p: 1,
        alignContent: "start",
      }}
    >
      {items.map(({ orthophoto, index }) => {
        const isHovered = hoveredIds?.has(orthophoto.id);
        const isDimmed = Boolean(hoveredIds) && !isHovered;
        const isSelected = orthophoto.id === selectedOrthophotoId;
        return (
          <Box
            key={orthophoto.id}
            onClick={() => onSelect(orthophoto)}
            sx={{
              position: "relative",
              aspectRatio: "1 / 1",
              borderRadius: 1,
              overflow: "hidden",
              cursor: "pointer",
              bgcolor: "grey.300",
              backgroundImage: `url("${orthophoto.sourceImage.thumbnail}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              outline: "2px solid",
              outlineColor: isHovered
                ? getOrthophotoHoverColor(theme.palette.secondary.main, index)
                : isSelected
                  ? "primary.main"
                  : "transparent",
              filter: isDimmed ? "grayscale(1)" : "none",
              opacity: isDimmed ? 0.3 : 1,
              transition: "opacity 0.12s, filter 0.12s",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                px: 0.5,
                py: "1px",
                fontWeight: 700,
                lineHeight: 1.4,
                color: "common.white",
                background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {orthophoto.name}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// PopperOrthophoto — floating panel of the unit orthophotos. Same shell as
// PopperComment / PopperImages: draggable header, PanelFooter with "auto" +
// bottom-left resize handle. A toggle at the top picks the view:
// - « Sélection »: the ORIGINAL photo of the selected station (its rectified
//   image is laid over the base map by OrthophotoOverlayLayer), with previous
//   / next station and, in the footer, the opacity of the rectified image;
// - « Source »: the grid of the original photos (GridSourcePhotos), which
//   follows the cursor over the base map. This view stays open without a
//   selected station.
// Close = deselect and back to « Sélection » (the panel leaves the screen).
// ---------------------------------------------------------------------------
export default function PopperOrthophoto({ orthophotos }) {
  const dispatch = useDispatch();

  // strings

  const prevS = "Orthophoto précédente";
  const nextS = "Orthophoto suivante";
  const closeS = "Fermer";
  const selectionS = "Sélection";
  const sourceS = "Source";
  const selectionTitleS = "Image d'origine de la station sélectionnée";
  const sourceTitleS = "Grille des photos d'origine";
  const missingS = "Image d'origine absente";
  const noSelectionS = "Cliquez sur une station ou sur une photo.";
  const opacityS = "Opacité de l'orthophoto sur le plan";
  const opacityLabelS = "Orthophoto";

  // data

  const selectedOrthophotoId = useSelector(
    (s) => s.orthophotos.selectedOrthophotoId
  );
  const popperMode = useSelector((s) => s.orthophotos.popperMode);
  const overlayOpacity = useSelector((s) => s.orthophotos.overlayOpacity);
  // The open right tool drawer slides over the editor: step aside.
  const rightDrawerWidth = useSelector((s) =>
    s.rightPanel.selectedMenuItemKey ? s.rightPanel.width : 0
  );

  // helpers

  const isSource = popperMode === "SOURCE";
  const index = orthophotos.findIndex((o) => o.id === selectedOrthophotoId);
  const orthophoto = index >= 0 ? orthophotos[index] : null;
  const prev = index > 0 ? orthophotos[index - 1] : null;
  const next =
    index >= 0 && index < orthophotos.length - 1
      ? orthophotos[index + 1]
      : null;
  const stop = (e) => e.stopPropagation();

  const sourceUrl = usePhotoImageUrl(
    isSource ? null : orthophoto?.sourceImage?.fileName
  );

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();
  const paperRef = useRef(null);
  const {
    size,
    isAutoHeight,
    handleResizeMouseDown,
    fitContent,
    reset: resetSize,
  } = usePanelResize({
    paperRef,
    minWidth: 240,
    minHeight: 180,
    anchor: "right",
  });

  // handlers

  function handleClose() {
    dispatch(setSelectedOrthophotoId(null));
    dispatch(setOrthophotoPopperMode("SELECTION"));
  }

  function handleSelectFromGrid(target) {
    dispatch(setSelectedOrthophotoId(target.id));
    dispatch(setOrthophotoPopperMode("SELECTION"));
  }

  // render

  // « Sélection » needs a station; « Source » stays open on its own
  if (!orthophoto && !isSource) return null;

  const hasFixedHeight = Boolean(size) && !isAutoHeight;

  return (
    <Paper
      ref={paperRef}
      elevation={8}
      data-capture-hide
      sx={{
        position: "absolute",
        top: TOP,
        right: RIGHT_GAP + rightDrawerWidth,
        zIndex: 12,
        width: size?.width ?? POPPER_WIDTH,
        maxWidth: `calc(100% - ${2 * RIGHT_GAP}px)`,
        ...(size
          ? {
              height: size.height,
              maxHeight: isAutoHeight
                ? getPanelAutoMaxHeight({
                    top: `${TOP}px`,
                    offsetY: position.y,
                  })
                : `calc(100% - ${TOP}px)`,
            }
          : {
              maxHeight: getPanelAutoMaxHeight({
                top: `${TOP}px`,
                offsetY: position.y,
              }),
            }),
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 2,
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
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 1,
          pr: 0.5,
          py: 0.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={isSource ? "SOURCE" : "SELECTION"}
          onMouseDown={stop}
          onChange={(_e, value) =>
            value && dispatch(setOrthophotoPopperMode(value))
          }
        >
          <ToggleButton
            value="SELECTION"
            title={selectionTitleS}
            sx={{ textTransform: "none", py: 0, px: 1 }}
          >
            {selectionS}
          </ToggleButton>
          <ToggleButton
            value="SOURCE"
            title={sourceTitleS}
            sx={{ textTransform: "none", py: 0, px: 1 }}
          >
            {sourceS}
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography
          variant="body2"
          sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}
          noWrap
        >
          {!isSource && orthophoto ? orthophoto.name : ""}
        </Typography>
        <Box onMouseDown={stop} sx={{ display: "flex", alignItems: "center" }}>
          {!isSource && (
            <>
              <IconButton
                size="small"
                title={prevS}
                disabled={!prev}
                onClick={() => dispatch(setSelectedOrthophotoId(prev?.id))}
              >
                <ChevronLeftIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                size="small"
                title={nextS}
                disabled={!next}
                onClick={() => dispatch(setSelectedOrthophotoId(next?.id))}
              >
                <ChevronRightIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </>
          )}
          <IconButton size="small" title={closeS} onClick={handleClose}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {isSource ? (
        /* Grid of the original photos */
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <GridSourcePhotos
            orthophotos={orthophotos}
            selectedOrthophotoId={selectedOrthophotoId}
            onSelect={handleSelectFromGrid}
          />
        </Box>
      ) : (
        /* Original photo of the selected station */
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: hasFixedHeight ? "hidden" : "auto",
            bgcolor: "grey.900",
          }}
        >
          {sourceUrl ? (
            <Box
              component="img"
              src={sourceUrl}
              alt={orthophoto.name}
              draggable={false}
              sx={
                hasFixedHeight
                  ? { width: 1, height: 1, objectFit: "contain" }
                  : { width: 1, height: "auto", display: "block" }
              }
            />
          ) : (
            <Typography variant="caption" sx={{ color: "grey.400", p: 3 }}>
              {!orthophoto
                ? noSelectionS
                : orthophoto.sourceImage?.fileName
                  ? "…"
                  : missingS}
            </Typography>
          )}
        </Box>
      )}

      <PanelFooter
        resizeCorner="bottom-left"
        onResizeMouseDown={handleResizeMouseDown}
        onResetSize={resetSize}
        onFitContent={fitContent}
        isAutoHeight={isAutoHeight}
        startContent={
          !isSource && orthophoto ? (
            <Tooltip title={opacityS} arrow>
              <Box
                onMouseDown={stop}
                sx={{ display: "flex", alignItems: "center", gap: 1, pl: 0.5 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {opacityLabelS}
                </Typography>
                <Slider
                  size="small"
                  min={0}
                  max={1}
                  step={0.05}
                  value={overlayOpacity}
                  onChange={(_e, v) => dispatch(setOrthophotoOverlayOpacity(v))}
                  sx={{ width: 110 }}
                />
              </Box>
            </Tooltip>
          ) : null
        }
      />
    </Paper>
  );
}
