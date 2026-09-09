import { useEffect, useState } from "react";

import {
  Box,
  MenuItem,
  Popover,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import usePlanningActions from "../hooks/usePlanningActions";

import {
  MAX_STEP_HOURS,
  MIN_STEP_HOURS,
  TIME_AXIS_MODES,
} from "../constants/planningDefaults";
import { getStepsPerDay } from "../utils/planningTimeAxis";

const STEP_HOURS_OPTIONS = [];
for (let h = MIN_STEP_HOURS; h <= MAX_STEP_HOURS; h++)
  STEP_HOURS_OPTIONS.push(h);

// Settings of a planning: label, time axis mode, step size, start date.
export default function PopoverPlanningSettings({
  anchorEl,
  planning,
  onClose,
}) {
  const { updatePlanning } = usePlanningActions();
  const [label, setLabel] = useState(planning?.label ?? "");

  useEffect(() => {
    setLabel(planning?.label ?? "");
  }, [planning?.label]);

  if (!planning) return null;
  const spd = getStepsPerDay(planning);

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <Box
        sx={{
          p: 2,
          width: 300,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <TextField
          size="small"
          label="Nom du planning"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label && label !== planning.label)
              updatePlanning(planning.id, { label });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.target.blur();
          }}
        />
        <Box>
          <Typography variant="caption" color="text.secondary">
            Axe de temps
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={planning.timeAxisMode ?? "CALENDAR"}
            onChange={(_e, v) => {
              if (v) updatePlanning(planning.id, { timeAxisMode: v });
            }}
            sx={{ mt: 0.5 }}
          >
            {TIME_AXIS_MODES.map((m) => (
              <ToggleButton key={m.key} value={m.key}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <TextField
          select
          size="small"
          label="Pas de temps"
          value={planning.stepHours ?? 4}
          onChange={(e) =>
            updatePlanning(planning.id, { stepHours: Number(e.target.value) })
          }
          helperText={`${spd} pas par jour · modifier le pas change les heures consommées de tous les blocs`}
        >
          {STEP_HOURS_OPTIONS.map((h) => (
            <MenuItem key={h} value={h}>
              {`${h} h`}
            </MenuItem>
          ))}
        </TextField>
        {planning.timeAxisMode === "CALENDAR" && (
          <TextField
            size="small"
            type="date"
            label="Date de début"
            value={planning.startDate ?? ""}
            onChange={(e) => {
              if (e.target.value)
                updatePlanning(planning.id, { startDate: e.target.value });
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Jours ouvrés (lundi → vendredi)"
          />
        )}
      </Box>
    </Popover>
  );
}
