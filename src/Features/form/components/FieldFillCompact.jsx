import { useState } from "react";

import {
  Box,
  Typography,
  Popover,
  IconButton,
  Slider,
  ButtonBase,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Texture as HatchingIcon,
  Square as SolidIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import ColorPickerContent from "Features/colors/components/ColorPickerContent";
import WhiteSectionGeneric from "./WhiteSectionGeneric";
import { FILL_FIELDS } from "Features/form/utils/styleFieldGroups";

const FILL_TYPES = [
  { value: "SOLID", title: "Plein" },
  { value: "HATCHING", title: "Hachures droite" },
  { value: "HATCHING_LEFT", title: "Hachures gauche" },
];

// Compact single-line fill editor: the fill type (motif) stays visible, and a
// colour·opacité swatch opens the shared colour popover (branded palette + hex +
// opacity). An optional global lock (shown when onOverrideFieldsChange is passed)
// locks/unlocks colour + type + opacity together for the template.
//
//   value: { fillColor, fillType, fillOpacity }   (fillOpacity is 0..1)
//   onChange(nextValue)                            — emits the full merged triad
//   overrideFields / onOverrideFieldsChange        — optional template override lock
//   disabledFields                                 — optional: grey out & disable fields
export default function FieldFillCompact({
  value,
  onChange,
  label = "Remplissage",
  overrideFields,
  onOverrideFieldsChange,
  disabledFields,
}) {
  const {
    fillColor = "#ffffff",
    fillType = "SOLID",
    fillOpacity = 1,
  } = value ?? {};

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const opacityPct = Math.round((fillOpacity ?? 1) * 100);

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    FILL_FIELDS.every((f) => overrideFields.includes(f));

  const isDisabled = (field) =>
    Array.isArray(disabledFields) && disabledFields.includes(field);
  const colorDisabled = isDisabled("fillColor");
  const typeDisabled = isDisabled("fillType");
  const opacityDisabled = isDisabled("fillOpacity");

  const disabledSx = { opacity: 0.4, pointerEvents: "none" };

  // handlers

  function handleColorChange(hex) {
    onChange({ ...value, fillColor: hex });
  }
  function handleTypeChange(e, newType) {
    if (newType !== null) onChange({ ...value, fillType: newType });
  }
  function handleOpacityChange(pct) {
    const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    onChange({ ...value, fillOpacity: clamped / 100 });
  }
  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !FILL_FIELDS.includes(f))
      : Array.from(new Set([...current, ...FILL_FIELDS]));
    onOverrideFieldsChange(next);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {label}
        </Typography>

        {/* fill type (motif) — always visible */}
        <ToggleButtonGroup
          value={fillType}
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
          {FILL_TYPES.map((t) => (
            <ToggleButton key={t.value} value={t.value} title={t.title}>
              {t.value === "SOLID" ? (
                <SolidIcon fontSize="small" />
              ) : (
                <HatchingIcon
                  fontSize="small"
                  sx={
                    t.value === "HATCHING_LEFT"
                      ? { transform: "scaleX(-1)" }
                      : undefined
                  }
                />
              )}
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
              bgcolor: fillColor,
              opacity: fillOpacity,
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

        {showOverrides && (
          <IconButton
            size="small"
            onClick={handleToggleGlobalOverride}
            title="Verrouiller couleur, motif et opacité pour le modèle"
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

      {/* colour + opacity popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } } }}
      >
        <ColorPickerContent
          color={fillColor}
          onColorChange={handleColorChange}
          onClose={() => setAnchorEl(null)}
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
