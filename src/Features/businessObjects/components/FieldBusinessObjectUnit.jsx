import {
  Box,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";

import { BUSINESS_OBJECT_UNITS } from "../constants/businessObjectEntityModel";
import getBusinessObjectQtyKind from "../utils/getBusinessObjectQtyKind";

// Quantity unit editor of a business object:
//
//   [ U | L | S ]  [ Unité ______ ]
//
// Left, the quantity KIND (U = count, L = length, S = surface) — a view
// derived from the unit text (getBusinessObjectQtyKind, the single rule);
// clicking a kind fills the unit with its default text (u / ml / m²). Right,
// the unit itself, a free text (kg, m³… are counted as units).
//
// Purely presentational: the caller owns the text. onUnitChange receives the
// new text (typed or chosen); onKindChange (optional) fires only on a kind
// click, for callers persisting at once (the panel commits the text on blur,
// which a toggle click never triggers).
//
//   unit / onUnitChange   — the unit text ("" = unit-less row)
//   onKindChange          — optional, (unitText) on a kind click
//   onBlur / onKeyDown    — optional passthrough on the text field
//   width                 — width of the text field (default 110)
const KIND_BY_UNIT_KEY = { U: "COUNT", L: "LENGTH", S: "SURFACE" };

const TOOLTIP_BY_UNIT_KEY = {
  U: "Unité (u) — nombre d'annotations",
  L: "Longueur (ml)",
  S: "Surface (m²)",
};

export default function FieldBusinessObjectUnit({
  unit,
  onUnitChange,
  onKindChange,
  onBlur,
  onKeyDown,
  width = 110,
}) {
  // strings

  const unitS = "Unité";
  const placeholderS = "u, ml, m²…";

  // data

  const kind = getBusinessObjectQtyKind(unit);
  const activeKey =
    BUSINESS_OBJECT_UNITS.find((item) => KIND_BY_UNIT_KEY[item.key] === kind)
      ?.key ?? null;

  // handlers

  function handleKindChange(_e, key) {
    // exclusive group: re-clicking the active button sends null → no-op
    if (!key || key === activeKey) return;
    const label = BUSINESS_OBJECT_UNITS.find((item) => item.key === key)?.label;
    if (!label) return;
    onUnitChange(label);
    onKindChange?.(label);
  }

  // render

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={activeKey}
        onChange={handleKindChange}
        sx={{
          flexShrink: 0,
          "& .MuiToggleButton-root": {
            px: 1.25,
            py: 0.5,
            fontSize: "0.75rem",
            textTransform: "none",
            fontWeight: 600,
          },
        }}
      >
        {BUSINESS_OBJECT_UNITS.map((item) => (
          <ToggleButton key={item.key} value={item.key}>
            <Tooltip
              title={TOOLTIP_BY_UNIT_KEY[item.key]}
              placement="top"
              arrow
            >
              <span>{item.key}</span>
            </Tooltip>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {/* free text; empty = unit-less row (a title, typically) */}
      <TextField
        size="small"
        label={unitS}
        placeholder={placeholderS}
        value={unit}
        onChange={(e) => onUnitChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        sx={{ width, flexShrink: 0 }}
      />
    </Box>
  );
}
