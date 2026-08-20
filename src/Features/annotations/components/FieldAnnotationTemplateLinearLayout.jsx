import { useState } from "react";

import {
  Box,
  Typography,
  Popover,
  Button,
  ButtonBase,
  IconButton,
  InputBase,
  Switch,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  MoreHoriz,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";

const DENSITY_MODE_OPTIONS = [
  { value: "SPACING", label: "Espacement (cm)" },
  { value: "PER_METER", label: "Barres / m" },
];

const ALIGN_OPTIONS = [
  { value: "LEFT", label: "Gauche" },
  { value: "CENTER", label: "Centré" },
  { value: "RIGHT", label: "Droite" },
];

// Ruler (axis + ticks) position across the band: middle, or at 25% from the
// bottom / top edge.
const AXIS_POSITION_OPTIONS = [
  { value: "BOTTOM", label: "Bas" },
  { value: "MIDDLE", label: "Milieu" },
  { value: "TOP", label: "Haut" },
];

// LINEAR_LAYOUT-specific template fields — also the subset restored by
// "Réinit." and toggled as one group by the padlock.
const LINEAR_LAYOUT_FIELDS = [
  "densityMode",
  "densityValue",
  "densityUnitLabel",
  "layoutAlign",
  "axisPosition",
  "textAlign",
  "hideBandFill",
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

const numberInputSx = {
  width: 64,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  px: 1,
  height: 28,
  fontSize: "0.8rem",
  "& input": { textAlign: "center", p: 0 },
};

// Compact single-line calepinage editor: a live summary of the distribution
// (density + alignment) stays visible, the fields live in a "..." popover.
// Same contract as FieldAnnotationTemplateCote.
export default function FieldAnnotationTemplateLinearLayout({
  annotationTemplate,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  label = "Calepinage",
}) {
  const {
    densityMode = "SPACING",
    densityValue = 33,
    densityUnitLabel = "jonc/m",
    layoutAlign = "CENTER",
    axisPosition = "MIDDLE",
    textAlign = "CENTER",
    hideBandFill = false,
  } = annotationTemplate ?? {};

  const [anchorEl, setAnchorEl] = useState(null);

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    LINEAR_LAYOUT_FIELDS.every((f) => overrideFields.includes(f));

  const alignLabel =
    ALIGN_OPTIONS.find((o) => o.value === layoutAlign)?.label ?? "Centré";
  const summary =
    densityMode === "PER_METER"
      ? `${densityValue} ${densityUnitLabel} • ${alignLabel}`
      : `esp. ${densityValue} cm • ${alignLabel}`;

  // handlers

  function handleDensityModeChange(e, newMode) {
    if (newMode !== null)
      onChange({ ...annotationTemplate, densityMode: newMode });
  }

  function handleDensityValueChange(raw) {
    const parsed = raw === "" ? "" : Number(raw);
    onChange({
      ...annotationTemplate,
      densityValue:
        parsed === "" || !Number.isFinite(parsed) ? "" : Math.max(0, parsed),
    });
  }

  function handleDensityUnitLabelChange(newLabel) {
    onChange({ ...annotationTemplate, densityUnitLabel: newLabel });
  }

  function handleLayoutAlignChange(e, newAlign) {
    if (newAlign !== null)
      onChange({ ...annotationTemplate, layoutAlign: newAlign });
  }

  function handleAxisPositionChange(e, newPosition) {
    if (newPosition !== null)
      onChange({ ...annotationTemplate, axisPosition: newPosition });
  }

  function handleTextAlignChange(e, newAlign) {
    if (newAlign !== null)
      onChange({ ...annotationTemplate, textAlign: newAlign });
  }

  function handleHideBandFillChange(e) {
    onChange({ ...annotationTemplate, hideBandFill: !e.target.checked });
  }

  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !LINEAR_LAYOUT_FIELDS.includes(f))
      : Array.from(new Set([...current, ...LINEAR_LAYOUT_FIELDS]));
    onOverrideFieldsChange(next);
  }

  function handleReset() {
    const defaults = getDefaultsForShape("LINEAR_LAYOUT");
    const patch = {};
    LINEAR_LAYOUT_FIELDS.forEach((field) => {
      if (field in defaults) patch[field] = defaults[field];
    });
    onChange({ ...annotationTemplate, ...patch });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {label}
        </Typography>

        <Typography variant="caption" color="text.secondary" noWrap>
          {summary}
        </Typography>

        {/* "..." → options popover */}
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          title="Options du calepinage"
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            height: 30,
            px: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
          }}
        >
          <MoreHoriz fontSize="small" />
        </ButtonBase>

        {showOverrides && (
          <IconButton
            size="small"
            onClick={handleToggleGlobalOverride}
            title="Appliquer ces réglages aux calepinages déjà créés"
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

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } } }}
      >
        <Box sx={{ width: 288 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              px: 1.5,
              pt: 1,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: "uppercase", flex: 1 }}
            >
              Distribution des barres
            </Typography>
            <Button size="small" onClick={handleReset}>
              Réinit.
            </Button>
          </Box>

          <Box
            sx={{
              px: 1.5,
              pb: 1,
              "& > *": { borderTop: "1px solid", borderColor: "divider" },
              "& > *:first-of-type": { borderTop: "none" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Densité
              </Typography>
              <ToggleButtonGroup
                value={densityMode}
                exclusive
                onChange={handleDensityModeChange}
                size="small"
                sx={toggleGroupSx}
              >
                {DENSITY_MODE_OPTIONS.map((o) => (
                  <ToggleButton key={o.value} value={o.value}>
                    {o.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {densityMode === "PER_METER" ? "Barres / m" : "Espacement"}
              </Typography>
              <InputBase
                type="number"
                value={densityValue ?? ""}
                onChange={(e) => handleDensityValueChange(e.target.value)}
                endAdornment={
                  <Typography variant="caption" color="text.secondary">
                    {densityMode === "PER_METER" ? "/m" : "cm"}
                  </Typography>
                }
                sx={numberInputSx}
              />
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
              <Typography variant="body2" sx={{ flex: 1, flexShrink: 0 }}>
                Unité affichée
              </Typography>
              <Box sx={{ width: 120 }}>
                <FieldTextV2
                  value={densityUnitLabel}
                  onChange={handleDensityUnitLabelChange}
                  options={{ fullWidth: true, placeholder: "jonc/m" }}
                />
              </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Alignement
              </Typography>
              <ToggleButtonGroup
                value={layoutAlign}
                exclusive
                onChange={handleLayoutAlignChange}
                size="small"
                sx={toggleGroupSx}
              >
                {ALIGN_OPTIONS.map((o) => (
                  <ToggleButton key={o.value} value={o.value}>
                    {o.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Position de la règle
              </Typography>
              <ToggleButtonGroup
                value={axisPosition}
                exclusive
                onChange={handleAxisPositionChange}
                size="small"
                sx={toggleGroupSx}
              >
                {AXIS_POSITION_OPTIONS.map((o) => (
                  <ToggleButton key={o.value} value={o.value}>
                    {o.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Position du texte
              </Typography>
              <ToggleButtonGroup
                value={textAlign}
                exclusive
                onChange={handleTextAlignChange}
                size="small"
                sx={toggleGroupSx}
              >
                {ALIGN_OPTIONS.map((o) => (
                  <ToggleButton key={o.value} value={o.value}>
                    {o.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                Colorier la bande
              </Typography>
              <Switch
                size="small"
                checked={!hideBandFill}
                onChange={handleHideBandFillChange}
              />
            </Box>
          </Box>
        </Box>
      </Popover>
    </WhiteSectionGeneric>
  );
}
