import { useState } from "react";

import {
  Box,
  Typography,
  Popover,
  IconButton,
  Slider,
  InputBase,
  ButtonBase,
  Button,
  Divider,
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
import { STRIP_DASH_DEFAULTS } from "Features/geometry/utils/getStripePolygons";

const STROKE_TYPES = [
  { value: "SOLID", title: "Trait plein", Icon: SolidLineIcon },
  { value: "DASHED", title: "Pointillés", Icon: DashedLineIcon },
];

const WIDTH_UNITS = [
  { value: "PX", label: "px" },
  { value: "CM", label: "cm" },
];

const WIDTH_PRESETS = [1, 2, 4, 8];

// The stroke props a single global lock toggles together.
const STROKE_FIELDS = [
  "strokeColor",
  "strokeType",
  "strokeOpacity",
  "strokeWidth",
  "strokeWidthUnit",
  "dashLength",
  "dashGap",
];

// Visual thickness (px) of the little stroke-preview bar, clamped so a large
// width stays legible in the compact button / presets.
function previewThickness(width) {
  return Math.max(1, Math.min(8, Number(width) || 1));
}

// Compact single-line stroke editor (design 2a): the line style stays visible,
// a dedicated ÉPAISSEUR button (stroke preview + value) opens a width popover
// (presets 1/2/4/8 + numeric + px/cm), and a separate colour·opacité swatch opens
// the shared colour popover (palette + hex + opacity only — width lives on its
// own button now). An optional global lock toggles all stroke props together.
//
//   value: { strokeColor, strokeType, strokeOpacity, strokeWidth, strokeWidthUnit,
//            dashLength, dashGap }
//   onChange(nextValue)                            — emits the full merged object
//   overrideFields / onOverrideFieldsChange        — optional template override lock
//   disabledFields                                 — optional: grey out & disable fields
//   withDashOptions                                — show the dash length/gap button
//                                                    when strokeType is DASHED (strips)
export default function FieldStrokeCompact({
  value,
  onChange,
  label = "Contour",
  overrideFields,
  onOverrideFieldsChange,
  disabledFields,
  withDashOptions = false,
}) {
  const {
    strokeColor = "#000000",
    strokeType = "SOLID",
    strokeOpacity = 1,
    strokeWidth = 1,
    strokeWidthUnit = "PX",
    dashLength,
    dashGap,
  } = value ?? {};

  const [anchorColor, setAnchorColor] = useState(null);
  const [anchorWidth, setAnchorWidth] = useState(null);

  const showDashOptions = withDashOptions && strokeType === "DASHED";

  const opacityPct = Math.round((strokeOpacity ?? 1) * 100);
  const unitLabel = strokeWidthUnit === "CM" ? "cm" : "px";

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
    const cleaned = String(raw)
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");
    onChange({ ...value, strokeWidth: cleaned === "" ? 0 : Number(cleaned) });
  }
  function handleUnitChange(e, unit) {
    if (unit !== null) onChange({ ...value, strokeWidthUnit: unit });
  }
  function handleDashFieldChange(field, raw) {
    const cleaned = String(raw)
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");
    onChange({ ...value, [field]: cleaned === "" ? null : Number(cleaned) });
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
            flexShrink: 0,
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

        {/* colour + opacity swatch → colour popover */}
        <ButtonBase
          onClick={(e) => setAnchorColor(e.currentTarget)}
          disabled={colorDisabled && opacityDisabled}
          title="Couleur et opacité"
          sx={{
            flexShrink: 0,
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
            sx={{
              fontWeight: "bold",
              color: "text.secondary",
              whiteSpace: "nowrap",
            }}
          >
            {opacityPct}%
          </Typography>
        </ButtonBase>

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

          {/* Colored dash blocks (DASHED strips) — own section */}
          {showDashOptions && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Typography
                variant="caption"
                sx={{ fontWeight: "bold", color: "text.secondary" }}
              >
                Bandes colorées
              </Typography>
              {[
                {
                  field: "dashLength",
                  label: "Longueur",
                  inputValue: dashLength,
                  placeholder: STRIP_DASH_DEFAULTS.dashLength,
                },
                {
                  field: "dashGap",
                  label: "Espacement",
                  inputValue: dashGap,
                  placeholder: STRIP_DASH_DEFAULTS.dashGap,
                },
              ].map(({ field, label: rowLabel, inputValue, placeholder }) => (
                <Box
                  key={field}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    ...(isDisabled("dashLength") ? disabledSx : {}),
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ flex: 1 }}
                  >
                    {rowLabel}
                  </Typography>
                  <InputBase
                    value={inputValue ?? ""}
                    placeholder={String(placeholder)}
                    onChange={(e) =>
                      handleDashFieldChange(field, e.target.value)
                    }
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
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: "bold",
                      color: "text.secondary",
                      width: 22,
                    }}
                  >
                    {unitLabel}
                  </Typography>
                </Box>
              ))}
            </>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="small" onClick={() => setAnchorWidth(null)}>
              OK
            </Button>
          </Box>
        </Box>
      </Popover>

      {/* colour popover — palette + opacity only (width moved to its own button) */}
      <Popover
        open={Boolean(anchorColor)}
        anchorEl={anchorColor}
        onClose={() => setAnchorColor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } } }}
      >
        <ColorPickerContent
          color={strokeColor}
          onColorChange={handleColorChange}
          onClose={() => setAnchorColor(null)}
        >
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
        </ColorPickerContent>
      </Popover>
    </WhiteSectionGeneric>
  );
}
