import { useState } from "react";

import {
  Box,
  Typography,
  Popover,
  IconButton,
  InputBase,
  ButtonBase,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import WhiteSectionGeneric from "./WhiteSectionGeneric";
import { STROKE_WIDTH_FIELDS } from "Features/form/utils/styleFieldGroups";

const WIDTH_UNITS = [
  { value: "PX", label: "px" },
  { value: "CM", label: "cm" },
];

const WIDTH_PRESETS = [1, 2, 4, 8];

// Visual thickness (px) of the little stroke-preview bar, clamped so a large
// width stays legible in the compact button / presets.
function previewThickness(width) {
  return Math.max(1, Math.min(8, Number(width) || 1));
}

// Compact single-line stroke WIDTH editor, split out of the "Contour" row so
// the width can be locked / unlocked independently of the line style: a
// button (stroke preview + value) opens a width popover (presets 1/2/4/8 +
// numeric + px/cm). The optional lock toggles strokeWidth AND strokeWidthUnit
// together (a numeric width is meaningless without its unit).
//
//   value: { strokeWidth, strokeWidthUnit }
//   onChange(nextValue)                            — emits the full merged object
//   overrideFields / onOverrideFieldsChange        — optional template override lock
//   disabledFields                                 — optional: grey out & disable
export default function FieldStrokeWidthCompact({
  value,
  onChange,
  label = "Épaisseur",
  overrideFields,
  onOverrideFieldsChange,
  disabledFields,
}) {
  const { strokeWidth = 1, strokeWidthUnit = "PX" } = value ?? {};

  const [anchorWidth, setAnchorWidth] = useState(null);

  const unitLabel = strokeWidthUnit === "CM" ? "cm" : "px";

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    STROKE_WIDTH_FIELDS.every((f) => overrideFields.includes(f));

  const widthDisabled =
    Array.isArray(disabledFields) && disabledFields.includes("strokeWidth");

  // handlers

  function handleWidthChange(raw) {
    const cleaned = String(raw)
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");
    onChange({ ...value, strokeWidth: cleaned === "" ? 0 : Number(cleaned) });
  }
  function handleUnitChange(e, unit) {
    if (unit !== null) onChange({ ...value, strokeWidthUnit: unit });
  }
  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !STROKE_WIDTH_FIELDS.includes(f))
      : Array.from(new Set([...current, ...STROKE_WIDTH_FIELDS]));
    onOverrideFieldsChange(next);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {label}
        </Typography>

        {/* width button → width popover */}
        <ButtonBase
          onClick={(e) => setAnchorWidth(e.currentTarget)}
          disabled={widthDisabled}
          title="Épaisseur du trait"
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            height: 30,
            px: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            ...(widthDisabled ? { opacity: 0.4 } : {}),
          }}
        >
          <Box
            sx={{
              width: 14,
              // string with unit: a bare 1 would be read as 100% by MUI sizing
              height: `${previewThickness(strokeWidth)}px`,
              borderRadius: 1,
              bgcolor: "text.primary",
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontWeight: "bold",
              color: "text.secondary",
              whiteSpace: "nowrap",
            }}
          >
            {strokeWidth} {unitLabel}
          </Typography>
        </ButtonBase>

        {showOverrides && (
          <IconButton
            size="small"
            onClick={handleToggleGlobalOverride}
            title="Verrouiller l'épaisseur pour le modèle"
            sx={{ color: allLocked ? "primary.main" : "text.disabled" }}
          >
            {allLocked ? (
              <LockIcon fontSize="small" />
            ) : (
              <LockOpenIcon fontSize="small" />
            )}
          </IconButton>
        )}
      </Box>

      {/* width popover — presets + numeric + unit */}
      <Popover
        open={Boolean(anchorWidth)}
        anchorEl={anchorWidth}
        onClose={() => setAnchorWidth(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } } }}
      >
        <Box
          sx={{
            p: 1.25,
            width: 210,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 0.5,
              p: 0.5,
              bgcolor: "action.hover",
              borderRadius: 1.5,
            }}
          >
            {WIDTH_PRESETS.map((w) => {
              const selected = Number(strokeWidth) === w;
              return (
                <ButtonBase
                  key={w}
                  onClick={() => onChange({ ...value, strokeWidth: w })}
                  title={`${w} px`}
                  sx={{
                    flex: 1,
                    height: 26,
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: selected ? "background.paper" : "transparent",
                    boxShadow: selected ? 1 : 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 18,
                      // string with unit: a bare 1 would be read as 100% by MUI sizing
                      height: `${previewThickness(w)}px`,
                      borderRadius: 1,
                      bgcolor: "text.primary",
                    }}
                  />
                </ButtonBase>
              );
            })}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <InputBase
              value={strokeWidth ?? ""}
              onChange={(e) => handleWidthChange(e.target.value)}
              sx={{
                width: 52,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                px: 1,
                height: 28,
                fontSize: "0.8rem",
                "& input": { textAlign: "center", p: 0 },
              }}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={strokeWidthUnit}
              onChange={handleUnitChange}
              sx={{
                "& .MuiToggleButton-root": {
                  px: 1,
                  py: 0.25,
                  fontSize: "0.7rem",
                },
              }}
            >
              {WIDTH_UNITS.map((u) => (
                <ToggleButton key={u.value} value={u.value}>
                  {u.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="small" onClick={() => setAnchorWidth(null)}>
              OK
            </Button>
          </Box>
        </Box>
      </Popover>
    </WhiteSectionGeneric>
  );
}
