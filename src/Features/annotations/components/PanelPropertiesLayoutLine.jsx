import { useState, useEffect } from "react";

import { useDispatch } from "react-redux";

import { setSubSelection } from "Features/selection/selectionSlice";

import {
  Box,
  Typography,
  IconButton,
  TextField,
  Menu,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  ArrowBack as Back,
  MoreVert as MoreActionsIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldCheck from "Features/form/components/FieldCheck";

import useSelectedLayoutLineData from "Features/annotations/hooks/useSelectedLayoutLineData";
import useDeleteLayoutLine from "Features/annotations/hooks/useDeleteLayoutLine";
import useUpdateLayoutLine from "Features/annotations/hooks/useUpdateLayoutLine";

import FormLayoutLineDensity from "./FormLayoutLineDensity";
import SvgLayoutLineBars from "./SvgLayoutLineBars";

const RENDER_MODE_OPTIONS = [
  { value: "TICKS", label: "Graduation" },
  { value: "ALL_BARS", label: "Toutes les barres" },
];

const toggleGroupSx = {
  flexShrink: 0,
  bgcolor: "action.hover",
  "& .MuiToggleButton-root": {
    border: "none",
    borderRadius: 1.5,
    px: 1,
    py: 0.25,
    fontSize: "0.7rem",
  },
};

// Properties panel of the sub-selected layoutLine ("Ligne de calepinage"):
// label, density / alignment, 2D render mode, and every bar drawn
// horizontally with its length.
export default function PanelPropertiesLayoutLine() {
  const dispatch = useDispatch();

  // data

  const { annotation, index, layoutLine, hasLayoutLine, count, layout } =
    useSelectedLayoutLineData();
  const deleteLayoutLine = useDeleteLayoutLine();
  const updateLayoutLine = useUpdateLayoutLine();

  // state

  const [label, setLabel] = useState(layoutLine?.label ?? "");
  const [anchorEl, setAnchorEl] = useState(null);

  // keep the field in sync when the underlying value changes (e.g. undo)
  useEffect(() => {
    setLabel(layoutLine?.label ?? "");
  }, [layoutLine?.label]);

  // handlers

  function handleBack() {
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  function commitLabel() {
    if (label === (layoutLine?.label ?? "")) return;
    updateLayoutLine(index, { label });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  }

  function handleDensityChange(patch) {
    updateLayoutLine(index, patch);
  }

  function handleRenderModeChange(e, value) {
    if (value !== null) updateLayoutLine(index, { renderMode: value });
  }

  function handleColorChange(color) {
    if (color) updateLayoutLine(index, { color });
  }

  function handleShowDensityInLabelChange(checked) {
    updateLayoutLine(index, { showDensityInLabel: Boolean(checked) });
  }

  function handleCoverWholeSurfaceChange(checked) {
    updateLayoutLine(index, { coverWholeSurface: Boolean(checked) });
  }

  function handleDelete() {
    setAnchorEl(null);
    if (annotation?.id)
      deleteLayoutLine({ annotationId: annotation.id, index });
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  // render - no selection

  if (!annotation || !hasLayoutLine) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucune ligne de calepinage sélectionnée
        </Typography>
      </Box>
    );
  }

  // render

  const barCount = layout?.barCount ?? 0;
  const totalLengthM = layout?.totalLengthM ?? 0;

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Sélection
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {count > 1
              ? `Ligne de calepinage ${index + 1}`
              : "Ligne de calepinage"}
          </Typography>
        </Box>
        <IconButton
          sx={{ ml: "auto" }}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <MoreActionsIcon />
        </IconButton>
        <Menu
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
        </Menu>
      </Box>

      <Box
        sx={{
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflowY: "auto",
        }}
      >
        <TextField
          label="Libellé"
          size="small"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={handleKeyDown}
        />

        <FieldCheck
          value={Boolean(layoutLine.showDensityInLabel)}
          onChange={handleShowDensityInLabelChange}
          label="Espacement et nbre de barres dans le libellé"
          options={{ type: "switch", showAsSection: true }}
        />

        <FieldColorV2
          label="Couleur"
          value={layoutLine.color ?? "#000000"}
          onChange={handleColorChange}
          options={{ showAsSection: true }}
        />

        <FormLayoutLineDensity
          line={layoutLine}
          onChange={handleDensityChange}
        />

        <FieldCheck
          value={Boolean(layoutLine.coverWholeSurface)}
          onChange={handleCoverWholeSurfaceChange}
          label="Calepiner sur toute la surface"
          options={{ type: "switch", showAsSection: true }}
        />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Rendu 2D
          </Typography>
          <ToggleButtonGroup
            value={layoutLine.renderMode ?? "TICKS"}
            exclusive
            onChange={handleRenderModeChange}
            size="small"
            sx={toggleGroupSx}
          >
            {RENDER_MODE_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            Barres
          </Typography>
          <SvgLayoutLineBars bars={layout?.bars ?? []} />
          <Typography variant="caption" color="text.secondary">
            {`${barCount} barre${barCount > 1 ? "s" : ""} — ${totalLengthM.toFixed(2)} ml`}
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary">
          {layoutLine.coverWholeSurface
            ? "Chaque barre est perpendiculaire à la ligne et s'arrête à la frontière du polygone ; les trous sont déduits du linéaire. La distribution est prolongée au-delà des extrémités de la ligne jusqu'à couvrir toute la surface."
            : "Chaque barre est perpendiculaire à la ligne et s'arrête à la frontière du polygone ; les trous sont déduits du linéaire. La distribution s'arrête aux deux extrémités de la ligne."}
        </Typography>
      </Box>
    </BoxFlexVStretch>
  );
}
