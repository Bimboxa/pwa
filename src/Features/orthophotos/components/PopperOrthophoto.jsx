import { useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedOrthophotoId,
  setOrthophotoOverlayOpacity,
} from "../orthophotosSlice";

import {
  Box,
  IconButton,
  Paper,
  Slider,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";

import PanelFooter from "Features/layout/components/PanelFooter";
import getPanelAutoMaxHeight from "Features/layout/utils/getPanelAutoMaxHeight";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import usePhotoImageUrl from "Features/photos/hooks/usePhotoImageUrl";

const POPPER_WIDTH = 420;
const RIGHT_GAP = 12;
const TOP = 50;

// ---------------------------------------------------------------------------
// PopperOrthophoto — floating panel of the selected unit orthophoto: its
// ORIGINAL photo (the rectified one is laid over the base map by
// OrthophotoOverlayLayer). Same shell as PopperComment / PopperImages:
// draggable header, PanelFooter with "auto" + bottom-left resize handle.
// Header: station name, previous / next station, close (= deselect, the
// rectified image leaves the base map). Footer: opacity of the rectified
// image.
// ---------------------------------------------------------------------------
export default function PopperOrthophoto({ orthophotos }) {
  const dispatch = useDispatch();

  // strings

  const prevS = "Orthophoto précédente";
  const nextS = "Orthophoto suivante";
  const closeS = "Fermer";
  const originalS = "Image d'origine";
  const missingS = "Image d'origine absente";
  const opacityS = "Opacité de l'orthophoto sur le plan";
  const opacityLabelS = "Orthophoto";

  // data

  const selectedOrthophotoId = useSelector(
    (s) => s.orthophotos.selectedOrthophotoId
  );
  const overlayOpacity = useSelector((s) => s.orthophotos.overlayOpacity);
  // The open right tool drawer slides over the editor: step aside.
  const rightDrawerWidth = useSelector((s) =>
    s.rightPanel.selectedMenuItemKey ? s.rightPanel.width : 0
  );

  // helpers

  const index = orthophotos.findIndex((o) => o.id === selectedOrthophotoId);
  const orthophoto = index >= 0 ? orthophotos[index] : null;
  const prev = index > 0 ? orthophotos[index - 1] : null;
  const next =
    index >= 0 && index < orthophotos.length - 1
      ? orthophotos[index + 1]
      : null;
  const stop = (e) => e.stopPropagation();

  const sourceUrl = usePhotoImageUrl(orthophoto?.sourceImage?.fileName);

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

  // render

  if (!orthophoto) return null;

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
          pl: 1.25,
          pr: 0.5,
          py: 0.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
          {orthophoto.name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ flex: 1, minWidth: 0 }}
        >
          {originalS}
        </Typography>
        <Box onMouseDown={stop} sx={{ display: "flex", alignItems: "center" }}>
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
          <IconButton
            size="small"
            title={closeS}
            onClick={() => dispatch(setSelectedOrthophotoId(null))}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Original photo */}
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
            {orthophoto.sourceImage?.fileName ? "…" : missingS}
          </Typography>
        )}
      </Box>

      <PanelFooter
        resizeCorner="bottom-left"
        onResizeMouseDown={handleResizeMouseDown}
        onResetSize={resetSize}
        onFitContent={fitContent}
        isAutoHeight={isAutoHeight}
        startContent={
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
        }
      />
    </Paper>
  );
}
