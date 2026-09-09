import { useState } from "react";

import {
  Box,
  ButtonBase,
  InputBase,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import { ArrowDropDown } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import {
  BUSINESS_OBJECT_UNITS,
  DEFAULT_HOURS_RATIO_MODE,
  DEFAULT_HOURS_RATIO_UNIT,
  HOURS_RATIO_MODES,
} from "../constants/businessObjectEntityModel";
import { getHoursRatioUnitLabel } from "../utils/hoursRatioConversions";

// One-line editor of a task's hours ratio:
//
//   [ Ratio | Cadence ]                       [ 0,5 │ h/m² ▾ ]
//
// Left, the mode; right, the value block — the number and its unit, the unit
// opening a small menu (u / ml / m²). That unit is the ratio's own
// (hoursRatioUnit), not the articles' quantity unit.
//
// Purely presentational: the caller owns the text, the mode and the unit (the
// creation dialog converts locally, the properties panel persists). The
// stored value is always the ratio (hours per unit), the mode only flips the
// displayed number.
//
//   text / onTextChange   — the number as typed, in the current mode
//   mode / onModeChange   — "RATIO" | "CADENCE" (ToggleButtonGroup signature)
//   unit / onUnitChange   — "U" | "L" | "S"
//   onBlur / onKeyDown    — optional passthrough on the input (commit hooks)
export default function FieldHoursRatioCompact({
  text,
  onTextChange,
  mode = DEFAULT_HOURS_RATIO_MODE,
  onModeChange,
  unit = DEFAULT_HOURS_RATIO_UNIT,
  onUnitChange,
  onBlur,
  onKeyDown,
}) {
  // state

  const [anchorUnit, setAnchorUnit] = useState(null);

  // strings

  const tooltipByMode = {
    RATIO: "Ratio — heures par unité",
    CADENCE: "Cadence — unités par heure (= 1 / ratio)",
  };
  const unitLabel = getHoursRatioUnitLabel(unit, mode);

  // handlers

  function handleUnitClick(unitKey) {
    setAnchorUnit(null);
    if (unitKey !== unit) onUnitChange(unitKey);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          width: 1,
        }}
      >
        {/* mode */}
        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={onModeChange}
          sx={{
            flexShrink: 0,
            "& .MuiToggleButton-root": {
              px: 1,
              py: 0.25,
              fontSize: "0.75rem",
              textTransform: "none",
            },
          }}
        >
          {HOURS_RATIO_MODES.map((m) => (
            <Tooltip key={m.key} title={tooltipByMode[m.key]} placement="top">
              <ToggleButton value={m.key}>{m.label}</ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>

        {/* value + unit */}
        <Box
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            height: 30,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            overflow: "hidden",
          }}
        >
          <InputBase
            value={text ?? ""}
            placeholder="—"
            onChange={(e) => onTextChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            slotProps={{ input: { inputMode: "decimal" } }}
            sx={{
              width: 56,
              px: 1,
              fontSize: "0.8rem",
              "& input": { textAlign: "right", p: 0 },
            }}
          />
          <ButtonBase
            onClick={(e) => setAnchorUnit(e.currentTarget)}
            title="Unité du ratio"
            sx={{
              alignSelf: "stretch",
              display: "flex",
              alignItems: "center",
              pl: 0.75,
              pr: 0.25,
              borderLeft: "1px solid",
              borderColor: "divider",
              fontSize: "0.75rem",
              fontWeight: "bold",
              color: "text.secondary",
              whiteSpace: "nowrap",
            }}
          >
            {unitLabel}
            <ArrowDropDown fontSize="small" sx={{ color: "text.disabled" }} />
          </ButtonBase>
        </Box>
      </Box>

      {/* unit menu — u / ml / m² */}
      <Menu
        open={Boolean(anchorUnit)}
        anchorEl={anchorUnit}
        onClose={() => setAnchorUnit(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {BUSINESS_OBJECT_UNITS.map((u) => (
          <MenuItem
            key={u.key}
            dense
            selected={u.key === unit}
            onClick={() => handleUnitClick(u.key)}
          >
            {u.label}
          </MenuItem>
        ))}
      </Menu>
    </WhiteSectionGeneric>
  );
}
