import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import {
  Box,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import StraightenIcon from "@mui/icons-material/Straighten";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

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

// Edit toolbar shown when a cote is selected. Three bands:
//   - top:    the cote length (read-only readout)
//   - middle: color (FieldColorV2), unit (FieldOptionKey), decimals (FieldTextV2)
//   - bottom: actions, with a right-aligned Delete button (no confirmation)
export default function ToolbarEditDimension({ onDragStart }) {
  const dispatch = useDispatch();

  const dimension = useSelectedDimension3d();
  const updateDimension3d = useUpdateDimension3d();
  const deleteDimension3d = useDeleteDimension3d();

  if (!dimension) return null;

  const color = dimension.color || DEFAULT_COTE_COLOR;
  const unit = dimension.unit || DEFAULT_COTE_UNIT;
  const decimals = dimension.decimals ?? DEFAULT_COTE_DECIMALS;

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

  return (
    <Paper
      elevation={6}
      sx={{ borderRadius: 2, overflow: "hidden", width: 280 }}
    >
      {/* Top band — the cote */}
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{ px: 1, py: 0.75 }}
      >
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "grab",
            color: "text.disabled",
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <StraightenIcon fontSize="small" sx={{ color }} />
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {formatCoteLength({ meters: dimension.length, unit, decimals })}
        </Typography>
      </Stack>

      <Divider />

      {/* Middle band — color, unit, decimals */}
      <Box>
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
          options={{ showAsField: true, isNumber: true }}
        />
      </Box>

      <Divider />

      {/* Bottom band — actions (delete right-aligned, no confirmation) */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        sx={{ px: 1, py: 0.5 }}
      >
        <Tooltip title="Supprimer la cote">
          <IconButton size="small" color="error" onClick={handleDeleteClick}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
