import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import { Box, Button, IconButton, Typography } from "@mui/material";
import {
  ArrowBack as Back,
  Delete as DeleteIcon,
  Straighten as StraightenIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldOptionKey from "Features/form/components/FieldOptionKey";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import useSelectedDimension3d from "../hooks/useSelectedDimension3d";
import useUpdateDimension3d from "../hooks/useUpdateDimension3d";
import useDeleteDimension3d from "../hooks/useDeleteDimension3d";
import formatCoteLength from "../utils/formatCoteLength";
import {
  COTE_UNIT_OPTIONS,
  DEFAULT_COTE_COLOR,
  DEFAULT_COTE_DECIMALS,
  DEFAULT_COTE_UNIT,
} from "../utils/coteConstants";

// Properties panel for the selected cote — DIMENSION node in the 3D viewer.
// Mirrors ToolbarEditDimension: length readout, color, unit, decimals, delete.
export default function PanelDimension3dProperties() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Sélection";
  const deleteS = "Supprimer";

  // data

  const dimension = useSelectedDimension3d();
  const updateDimension3d = useUpdateDimension3d();
  const deleteDimension3d = useDeleteDimension3d();

  // helpers

  const color = dimension?.color || DEFAULT_COTE_COLOR;
  const unit = dimension?.unit || DEFAULT_COTE_UNIT;
  const decimals = dimension?.decimals ?? DEFAULT_COTE_DECIMALS;

  // handlers

  function handleBack() {
    dispatch(clearSelection());
  }

  function handleColorChange(hex) {
    updateDimension3d(dimension.id, { color: hex });
  }

  function handleUnitChange(nextUnit) {
    updateDimension3d(dimension.id, { unit: nextUnit });
  }

  function handleDecimalsChange(value) {
    const parsed = value === "" || value === null ? 0 : Number(value);
    const clamped = Math.max(0, Math.min(6, Math.floor(parsed)));
    updateDimension3d(dimension.id, {
      decimals: Number.isFinite(clamped) ? clamped : 0,
    });
  }

  async function handleDeleteClick() {
    await deleteDimension3d(dimension.id);
    dispatch(clearSelection());
  }

  // render - no selection

  if (!dimension) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucune cote sélectionnée
        </Typography>
      </Box>
    );
  }

  // render

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <StraightenIcon fontSize="small" sx={{ color, mx: 1 }} />
        <Box>
          <Typography variant="caption" color="text.secondary">
            {captionS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {formatCoteLength({ meters: dimension.length, unit, decimals })}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          p: 1,
          overflow: "auto",
        }}
      >
        {/* Card 1: color, unit, decimals */}
        <WhiteSectionGeneric>
          <FieldColorV2
            label="Couleur"
            value={color}
            onChange={handleColorChange}
            options={{ showAsSection: true }}
          />
          <FieldOptionKey
            label="Unité"
            value={unit}
            onChange={handleUnitChange}
            valueOptions={COTE_UNIT_OPTIONS}
            options={{ showAsSection: true }}
          />
          <FieldTextV2
            label="Décimales"
            value={decimals}
            onChange={handleDecimalsChange}
            options={{
              showAsField: true,
              changeOnBlur: true,
              hideMic: true,
            }}
          />
        </WhiteSectionGeneric>

        {/* Card 2: delete */}
        <WhiteSectionGeneric>
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteClick}
            fullWidth
            size="small"
          >
            {deleteS}
          </Button>
        </WhiteSectionGeneric>
      </Box>
    </BoxFlexVStretch>
  );
}
