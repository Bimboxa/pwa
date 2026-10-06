import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import {
  Box,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  Contrast as HalfViewIcon,
  DeleteOutline as DeleteIcon,
  DonutLarge as PartialIcon,
  Flip as FlipIcon,
  Lens as TotalIcon,
} from "@mui/icons-material";

import useCreateRevolutionAxisBaseMap from "Features/revolutionAxes/hooks/useCreateRevolutionAxisBaseMap";
import useRevolutionAxisActions from "Features/revolutionAxes/hooks/useRevolutionAxisActions";
import useRevolutionAxisLinkedBaseMaps from "Features/revolutionAxes/hooks/useRevolutionAxisLinkedBaseMaps";

import {
  OVERLAY_BUTTON_PX,
  OVERLAY_GAP_PX,
  OVERLAY_H_PX,
  OVERLAY_OFFSET_PX,
} from "./NodeSegmentLengthsStatic";

// Quick-action row above a selected plan REVOLUTION_AXIS — the axis
// counterpart of the NodeSegmentLengthsStatic overlay of a polyline: HTML
// buttons in a counter-scaled foreignObject, anchored just above the clicked
// point (mapEditorSlice.annotationOverlayAnchor) or, when the selection came
// from a panel, above the top of the circle.
//
// Buttons: invert the half-revolutions · partial / total revolution · 3D
// half-view · coupe base map (creates the A3 page + poses the axis when none
// is linked yet, navigates otherwise — menu when several) · delete (two
// clicks, ⌫ hotkey of the map editor).
const ACCENT_COLOR = "#2196f3";
const BUTTON_COUNT = 5;
const DELETE_CONFIRM_MS = 2500;

const buttonSx = (active) => ({
  position: "relative",
  bgcolor: "rgba(255,255,255,0.9)",
  border: `1px solid ${ACCENT_COLOR}`,
  color: active ? ACCENT_COLOR : "text.disabled",
  "&:hover": { bgcolor: "white", color: ACCENT_COLOR },
  p: 0.5,
});

const hotkeyBadgeSx = {
  position: "absolute",
  top: -6,
  right: -6,
  minWidth: 12,
  height: 12,
  px: "2px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "3px",
  bgcolor: "background.paper",
  fontSize: 8,
  fontWeight: 700,
  lineHeight: 1,
  color: "text.secondary",
};

// The overlay must not read as a click on the axis: InteractionLayer's
// capture-phase mousedown skips anything inside a `ui-overlay`, and the
// bubbling events are stopped here (a mouseup would clear the selection).
const overlayGuards = {
  onPointerDown: (e) => e.stopPropagation(),
  onPointerUp: (e) => e.stopPropagation(),
  onMouseDown: (e) => e.stopPropagation(),
  onMouseUp: (e) => e.stopPropagation(),
  onClick: (e) => e.stopPropagation(),
};

export default function NodeRevolutionAxisOverlayStatic({
  annotation,
  centerPx,
  radiusPx,
  containerK = 1,
}) {
  // strings

  const invertS = "Inverser les demi-révolutions";
  const partialS = "Révolution partielle";
  const totalS = "Révolution totale";
  const halfViewOnS = "Demi-vue 3D (coupe) : activée";
  const halfViewOffS = "Demi-vue 3D (coupe) : désactivée";
  const createS =
    "Créer le fond de plan de coupe (A3 à l'échelle) et y poser l'axe";
  const goToS = "Voir le fond de plan des profils";
  const linkedS = "Fonds de plan liés";
  const deleteS = "Supprimer (⌫)";
  const confirmDeleteS = "Confirmer la suppression";

  // data

  const interactionMode = useSelector(
    (s) => s.popperMapListings?.interactionMode
  );
  const hasMultiSelection = useSelector(
    (s) => (s.selection?.selectedItems?.length ?? 0) > 1
  );
  const clickAnchor = useSelector((s) => s.mapEditor.annotationOverlayAnchor);

  const actions = useRevolutionAxisActions(annotation);
  const { linkedBaseMaps, goTo } = useRevolutionAxisLinkedBaseMaps(annotation);
  const { createForAxis, creating } = useCreateRevolutionAxisBaseMap();

  // state

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [linkMenuAnchor, setLinkMenuAnchor] = useState(null);

  useEffect(() => {
    if (!deleteConfirm) return;
    const t = setTimeout(() => setDeleteConfirm(false), DELETE_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [deleteConfirm]);

  // helpers

  const annotationId = annotation?.id;
  const isNoMode = interactionMode == null;
  const active = (isNoMode || interactionMode === "EDIT") && !hasMultiSelection;

  const anchor = useMemo(() => {
    if (
      clickAnchor?.space === "MAP_PX" &&
      clickAnchor.annotationId === annotationId &&
      Number.isFinite(clickAnchor.x) &&
      Number.isFinite(clickAnchor.y)
    ) {
      return { x: clickAnchor.x, y: clickAnchor.y };
    }
    if (!centerPx) return null;
    return { x: centerPx.x, y: centerPx.y - (radiusPx || 0) };
  }, [clickAnchor, annotationId, centerPx, radiusPx]);

  const counterScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  const overlayWidth =
    BUTTON_COUNT * OVERLAY_BUTTON_PX + (BUTTON_COUNT - 1) * OVERLAY_GAP_PX;

  const hasLinked = linkedBaseMaps.length > 0;

  // handlers

  function handleBaseMapClick(e) {
    if (creating) return;
    if (!hasLinked) {
      createForAxis(annotation);
      return;
    }
    if (linkedBaseMaps.length === 1) {
      goTo(linkedBaseMaps[0].id);
      return;
    }
    setLinkMenuAnchor(e.currentTarget);
  }

  function handleGoTo(baseMapId) {
    setLinkMenuAnchor(null);
    goTo(baseMapId);
  }

  function handleDeleteClick() {
    if (deleteConfirm) {
      setDeleteConfirm(false);
      actions.deleteAxis();
    } else {
      setDeleteConfirm(true);
    }
  }

  // render

  if (!active || !anchor) return null;

  return (
    <g transform={`translate(${anchor.x}, ${anchor.y})`}>
      <g style={{ transform: counterScaleTransform }}>
        <foreignObject
          x={-overlayWidth / 2}
          y={-OVERLAY_OFFSET_PX}
          width={overlayWidth}
          height={OVERLAY_H_PX}
          style={{ overflow: "visible" }}
        >
          <div
            data-interaction="ui-overlay"
            {...overlayGuards}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: OVERLAY_GAP_PX,
            }}
          >
            <Tooltip placement="top" arrow title={invertS}>
              <IconButton
                size="small"
                onClick={actions.toggleInvertHalf}
                sx={buttonSx(Boolean(annotation?.invertHalf))}
              >
                <FlipIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>

            <Tooltip
              placement="top"
              arrow
              title={actions.isPartial ? totalS : partialS}
            >
              <IconButton
                size="small"
                onClick={actions.togglePartial}
                sx={buttonSx(actions.isPartial)}
              >
                {actions.isPartial ? (
                  <PartialIcon sx={{ fontSize: 18 }} />
                ) : (
                  <TotalIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip
              placement="top"
              arrow
              title={actions.isHalfView ? halfViewOnS : halfViewOffS}
            >
              <IconButton
                size="small"
                onClick={actions.toggleHalfView}
                sx={buttonSx(actions.isHalfView)}
              >
                <HalfViewIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>

            <Tooltip placement="top" arrow title={hasLinked ? goToS : createS}>
              <span>
                <IconButton
                  size="small"
                  onClick={handleBaseMapClick}
                  disabled={creating}
                  sx={buttonSx(hasLinked)}
                >
                  {creating ? (
                    <CircularProgress size={18} thickness={5} />
                  ) : hasLinked ? (
                    <ArrowForwardIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <AddIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip
              placement="top"
              arrow
              title={deleteConfirm ? confirmDeleteS : deleteS}
            >
              <IconButton
                size="small"
                onClick={handleDeleteClick}
                sx={{
                  ...buttonSx(false),
                  ...(deleteConfirm
                    ? {
                        color: "error.main",
                        borderColor: "error.main",
                        bgcolor: "error.lighter",
                      }
                    : {}),
                  "&:hover": {
                    bgcolor: "white",
                    color: "error.main",
                    borderColor: "error.main",
                  },
                }}
              >
                <DeleteIcon sx={{ fontSize: 18 }} />
                <Box component="span" sx={hotkeyBadgeSx}>
                  ⌫
                </Box>
              </IconButton>
            </Tooltip>
          </div>
        </foreignObject>
      </g>

      {/* Several linked base maps: pick the one to show */}
      <Menu
        anchorEl={linkMenuAnchor}
        open={Boolean(linkMenuAnchor)}
        onClose={() => setLinkMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        <MenuItem disabled dense sx={{ opacity: "1 !important" }}>
          <ListItemText
            primaryTypographyProps={{
              variant: "caption",
              color: "text.secondary",
            }}
          >
            {linkedS}
          </ListItemText>
        </MenuItem>
        {linkedBaseMaps.map((bm) => (
          <MenuItem key={bm.id} dense onClick={() => handleGoTo(bm.id)}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {bm.name}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </g>
  );
}
