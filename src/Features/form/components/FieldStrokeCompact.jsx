import { useState } from "react";

import {
  Box,
  Typography,
  Popover,
  IconButton,
  Slider,
  InputBase,
  ButtonBase,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  HorizontalRule as SolidLineIcon,
  LineStyle as DashedLineIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import ColorPickerContent from "Features/colors/components/ColorPickerContent";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

const STROKE_TYPES = [
  { value: "SOLID", title: "Plein", Icon: SolidLineIcon },
  { value: "DASHED", title: "Pointillé", Icon: DashedLineIcon },
];

const WIDTH_UNITS = [
  { value: "PX", label: "px" },
  { value: "CM", label: "cm" },
];

// The stroke props a single global lock toggles together.
const STROKE_FIELDS = [
  "strokeColor",
  "strokeType",
  "strokeOpacity",
  "strokeWidth",
  "strokeWidthUnit",
];

// Compact single-line stroke editor (sibling of FieldFillCompact): the line
// style stays visible, and a colour·opacité swatch opens the shared colour
// popover (branded palette + hex + opacity + width). An optional global lock
// locks/unlocks all the stroke props together for the template.
//
//   value: { strokeColor, strokeType, strokeOpacity, strokeWidth, strokeWidthUnit }
//   onChange(nextValue)                            — emits the full merged object
//   overrideFields / onOverrideFieldsChange        — optional template override lock
//   disabledFields                                 — optional: grey out & disable fields
export default function FieldStrokeCompact({
  value,
  onChange,
  label = "Contour",
  overrideFields,
  onOverrideFieldsChange,
  disabledFields,
}) {
  const {
    strokeColor = "#000000",
    strokeType = "SOLID",
    strokeOpacity = 1,
    strokeWidth = 1,
    strokeWidthUnit = "PX",
  } = value ?? {};

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const opacityPct = Math.round((strokeOpacity ?? 1) * 100);

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    STROKE_FIELDS.every((f) => overrideFields.includes(f));

  const isDisabled = (field) =>
    Array.isArray(disabledFields) && disabledFields.includes(field);
  const colorDisabled = isDisabled("strokeColor");
  const typeDisabled = isDisabled("strokeType");
  const opacityDisabled = isDisabled("strokeOpacity");
  const widthDisabled = isDisabled("strokeWidth");

  const disabledSx = { opacity: 0.4, pointerEvents: "none" };

  // handlers

  function handleColorChange(hex) {
    onChange({ ...value, strokeColor: hex });
  }
  function handleTypeChange(e, newType) {
    if (newType !== null) onChange({ ...value, strokeType: newType });
  }
  function handleOpacityChange(pct) {
    const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    onChange({ ...value, strokeOpacity: clamped / 100 });
  }
  function handleWidthChange(raw) {
    const cleaned = raw.replace(",", ".").replace(/[^0-9.]/g, "");
    onChange({ ...value, strokeWidth: cleaned === "" ? 0 : Number(cleaned) });
  }
  function handleUnitChange(e, unit) {
    if (unit !== null) onChange({ ...value, strokeWidthUnit: unit });
  }
  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !STROKE_FIELDS.includes(f))
      : Array.from(new Set([...current, ...STROKE_FIELDS]));
    onOverrideFieldsChange(next);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {showOverrides && (
          <IconButton
            size="small"
            onClick={handleToggleGlobalOverride}
            title="Verrouiller le contour pour le modèle"
            sx={{ color: allLocked ? "primary.main" : "text.disabled" }}
          >
            {allLocked ? (
              <LockIcon fontSize="small" />
            ) : (
              <LockOpenIcon fontSize="small" />
            )}
          </IconButton>
        )}

        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {label}
        </Typography>

        {/* line style — always visible */}
        <ToggleButtonGroup
          value={strokeType}
          exclusive
          onChange={handleTypeChange}
          size="small"
          disabled={typeDisabled}
          sx={{
            bgcolor: "action.hover",
            "& .MuiToggleButton-root": {
              border: "none",
              borderRadius: 1.5,
              px: 1,
              py: 0.5,
            },
          }}
        >
          {STROKE_TYPES.map(({ value: v, title, Icon }) => (
            <ToggleButton key={v} value={v} title={title}>
              <Icon fontSize="small" />
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* colour + opacity swatch → popover */}
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          disabled={colorDisabled && opacityDisabled}
          title="Couleur et opacité"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            height: 30,
            pl: 0.5,
            pr: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
          }}
        >
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: 1,
              bgcolor: strokeColor,
              opacity: strokeOpacity,
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
            }}
          />
          <Typography
            variant="caption"
            sx={{ fontWeight: "bold", color: "text.secondary" }}
          >
            {opacityPct}%
          </Typography>
        </ButtonBase>
      </Box>

      {/* colour + opacity + width popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } } }}
      >
        <ColorPickerContent
          color={strokeColor}
          onColorChange={handleColorChange}
          onClose={() => setAnchorEl(null)}
        >
          {/* opacity */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              ...(opacityDisabled ? disabledSx : {}),
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 52 }}
            >
              Opacité
            </Typography>
            <Slider
              size="small"
              value={opacityPct}
              min={0}
              max={100}
              onChange={(e, v) => handleOpacityChange(v)}
              sx={{ flex: 1, color: "primary.main" }}
            />
            <Typography
              variant="caption"
              sx={{ fontWeight: "bold", minWidth: 34, textAlign: "right" }}
            >
              {opacityPct}%
            </Typography>
          </Box>

          {/* width + unit */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              ...(widthDisabled ? disabledSx : {}),
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 52 }}
            >
              Épaisseur
            </Typography>
            <InputBase
              value={strokeWidth ?? ""}
              onChange={(e) => handleWidthChange(e.target.value)}
              sx={{
                width: 56,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                px: 1,
                height: 28,
                fontSize: "0.8rem",
                "& input": { textAlign: "right", p: 0 },
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
        </ColorPickerContent>
      </Popover>
    </WhiteSectionGeneric>
  );
}
