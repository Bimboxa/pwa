import { useDispatch } from "react-redux";

import {
  setSelectedMainBaseMapId,
  setSelectedNode,
  setZoomTo,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronRight from "@mui/icons-material/ChevronRight";

// ---------------------------------------------------------------------------
// RowTemplateAnnotation — one annotation of the detail view (#311): color
// swatch, derived label ("Mur béton ext 01"), quantities line and a chevron.
// Clicking selects the annotation on the map (DatagridAnnotations
// handleViewOnMap pattern), zooms to it and opens its properties panel.
// ---------------------------------------------------------------------------

function formatQty(value) {
  return Number.isFinite(value) && value !== 0 ? value.toFixed(2) : "0";
}

export default function RowTemplateAnnotation({ annotation, label, color }) {
  const dispatch = useDispatch();

  // helpers

  // Prefer the developed values (sloped strips / guideLine ramps), like
  // computeAnnotationTemplateQties.
  const qties = annotation.qties;
  const length = qties?.lengthDeveloped ?? qties?.length ?? 0;
  const surface = qties?.surfaceDeveloped ?? qties?.surface ?? 0;
  const qtyLine = `${formatQty(length)} ml · ${formatQty(surface)} m²`;

  // handlers

  const handleClick = () => {
    if (annotation.baseMapId)
      dispatch(setSelectedMainBaseMapId(annotation.baseMapId));
    dispatch(
      setSelectedNode({
        nodeId: annotation.id,
        nodeType: "ANNOTATION",
        nodeListingId: annotation.listingId,
        annotationType: annotation.type,
        origin: "LISTING",
      })
    );
    dispatch(
      setSelectedItem({
        id: annotation.id,
        type: "NODE",
        nodeType: "ANNOTATION",
        nodeId: annotation.id,
        annotationType: annotation.type,
        listingId: annotation.listingId,
        entityId: annotation.entityId,
        annotationTemplateId: annotation.annotationTemplateId,
      })
    );
    dispatch(setShowAnnotationsProperties(true));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
    if (annotation.points?.length > 0) {
      dispatch(setZoomTo(annotation.points[0]));
    } else if (annotation.x != null) {
      dispatch(setZoomTo({ x: annotation.x, y: annotation.y }));
    }
  };

  // render

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        cursor: "pointer",
        bgcolor: "background.paper",
        "&:hover": { bgcolor: "action.hover" },
        "&:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      {/* Color swatch */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          flexShrink: 0,
          bgcolor: alpha(color, 0.2),
        }}
      />

      {/* Label + quantities */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 700, userSelect: "none" }}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{
            display: "block",
            fontFamily: "monospace",
            fontWeight: 500,
            color: "text.secondary",
          }}
        >
          {qtyLine}
        </Typography>
      </Box>

      <ChevronRight
        sx={{ fontSize: 20, color: "panel.textLight", flexShrink: 0 }}
      />
    </Box>
  );
}
