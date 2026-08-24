import { useState } from "react";
import { useDispatch } from "react-redux";

import { setDetailAnnotationId } from "Features/panelDrawing/panelDrawingSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronRight from "@mui/icons-material/ChevronRight";

import IconPointer from "Features/icons/IconPointer";
import useSelectAnnotationFromPanel from "Features/panelDrawing/hooks/useSelectAnnotationFromPanel";

// ---------------------------------------------------------------------------
// RowTemplateAnnotation — one annotation of the detail view (#311): color
// swatch, derived label ("Mur béton ext 01"), quantities line and a chevron.
// Clicking only opens the annotation subview in the panel; the hover pointer
// button selects the annotation on the map directly (same action as the
// subview's "Sélectionner").
// ---------------------------------------------------------------------------

function formatQty(value) {
  return Number.isFinite(value) && value !== 0 ? value.toFixed(2) : "0";
}

export default function RowTemplateAnnotation({ annotation, label, color }) {
  const dispatch = useDispatch();

  // data

  const selectAnnotation = useSelectAnnotationFromPanel();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  // Prefer the developed values (sloped strips / guideLine ramps), like
  // computeAnnotationTemplateQties.
  const qties = annotation.qties;
  const length = qties?.lengthDeveloped ?? qties?.length ?? 0;
  const surface = qties?.surfaceDeveloped ?? qties?.surface ?? 0;
  const qtyLine = `${formatQty(length)} ml · ${formatQty(surface)} m²`;

  // handlers

  const handleClick = () => {
    dispatch(setDetailAnnotationId(annotation.id));
  };

  const handleSelectClick = (e) => {
    e.stopPropagation();
    selectAnnotation(annotation);
  };

  // render

  return (
    <Box
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

      {/* Select on map (hover) — same action as the subview's "Sélectionner" */}
      {isHovered && (
        <Tooltip title="Sélectionner sur le plan" arrow>
          <IconButton
            size="small"
            onClick={handleSelectClick}
            sx={{
              p: 0.5,
              flexShrink: 0,
              color: "panel.textMuted",
              bgcolor: "action.hover",
              borderRadius: 1,
              "&:hover": { bgcolor: "panel.textMuted", color: "white" },
            }}
          >
            <IconPointer sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}

      <ChevronRight
        sx={{ fontSize: 20, color: "panel.textLight", flexShrink: 0 }}
      />
    </Box>
  );
}
