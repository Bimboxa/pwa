import { useState } from "react";

import {
  Box,
  Typography,
  Popover,
  Switch,
  Button,
  ButtonBase,
  IconButton,
  InputBase,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  MoreHoriz,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getCoteDisplayValue from "Features/annotations/utils/getCoteDisplayValue";
import {
  getDefaultsForShape,
  resolveDrawingShape,
} from "Features/annotations/constants/drawingShapeConfig";

const UNIT_OPTIONS = [
  { value: "CM", label: "cm" },
  { value: "M", label: "m" },
];

const DECIMALS_OPTIONS = [0, 1, 2];

// Cote-specific template fields — also the subset restored by "Réinit.".
const COTE_FIELDS = [
  "unit",
  "extensionOffset",
  "extensionOffsetUnit",
  "decimals",
  "fontSize",
  "showUnitLabel",
  // RULER only (see showTotalOption / showLabelOption), but kept in the
  // lock/reset group so the padlock and "Réinit." stay consistent with what
  // the popover shows.
  "showTotalCote",
  "showRulerLabel",
];

// Preview sample: a 1.63 m long cote (163 px at 1 cm/px).
const PREVIEW_SAMPLE = {
  p1: { x: 0, y: 0 },
  p2: { x: 163, y: 0 },
  meterByPx: 0.01,
};

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

// Compact single-line cote editor: the display unit stays visible, every other
// option (extension offset, text size, decimals, unit suffix) lives in a "..."
// popover with a live 2D preview of the resulting cote.
export default function FieldAnnotationTemplateCote({
  annotationTemplate,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  label = "Cote",
  // RULER: a dimension chain can additionally show a cumulative "total" cote
  // on a second alignment line. Meaningless for a 2-point COTE.
  showTotalOption = false,
  // RULER: the annotation label can be drawn (italic) along the chain's
  // end-to-end axis, on the side opposite the values.
  showLabelOption = false,
}) {
  const {
    unit = "CM",
    extensionOffset = 8,
    decimals = 0,
    fontSize = 18,
    showUnitLabel = true,
    showTotalCote = false,
    showRulerLabel = false,
    strokeColor = "#000000",
  } = annotationTemplate ?? {};

  const [anchorEl, setAnchorEl] = useState(null);

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    COTE_FIELDS.every((f) => overrideFields.includes(f));

  // helpers — preview geometry (screen px, extensionOffset treated as px)

  const previewExt = Math.max(0, Math.min(30, Number(extensionOffset) || 0));
  const previewFontSize = Math.max(8, Math.min(24, Number(fontSize) || 18));
  // The (italic) label prefixes the value: "Libellé = 1.63 m".
  const previewShowLabel = showLabelOption && Boolean(showRulerLabel);
  const barY = 4;
  const barH = 10;
  const clickY = barY + barH; // extension lines start on the bar's bottom edge
  const dimY = clickY + previewExt;
  const svgH = dimY + 6 + previewFontSize + 6;
  const x1 = 14;
  const x2 = 206;

  const previewText = getCoteDisplayValue({
    ...PREVIEW_SAMPLE,
    unit,
    decimals,
    showUnitLabel,
  });

  // handlers

  function handleUnitChange(e, newUnit) {
    if (newUnit !== null) onChange({ ...annotationTemplate, unit: newUnit });
  }

  function handleExtensionOffsetChange(raw) {
    const parsed = raw === "" ? 0 : Number(raw);
    onChange({
      ...annotationTemplate,
      extensionOffset: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
      // px only in the UI — normalize any legacy CM value on edit
      extensionOffsetUnit: "PX",
    });
  }

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? 18 : Number(raw);
    onChange({
      ...annotationTemplate,
      fontSize: Number.isFinite(parsed) && parsed > 0 ? parsed : 18,
    });
  }

  function handleDecimalsChange(e, newDecimals) {
    if (newDecimals !== null)
      onChange({ ...annotationTemplate, decimals: newDecimals });
  }

  function handleShowUnitLabelChange(e) {
    onChange({ ...annotationTemplate, showUnitLabel: e.target.checked });
  }

  function handleShowTotalCoteChange(e) {
    onChange({ ...annotationTemplate, showTotalCote: e.target.checked });
  }

  function handleShowRulerLabelChange(e) {
    onChange({ ...annotationTemplate, showRulerLabel: e.target.checked });
  }

  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !COTE_FIELDS.includes(f))
      : Array.from(new Set([...current, ...COTE_FIELDS]));
    onOverrideFieldsChange(next);
  }

  function handleReset() {
    // Shape-aware: a RULER has its own cote defaults (metres / 2 decimals /
    // wider offset), restoring COTE's would silently change the display.
    const defaults = getDefaultsForShape(
      resolveDrawingShape(annotationTemplate) ?? "COTE"
    );
    const patch = {};
    COTE_FIELDS.forEach((field) => {
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

        {/* display unit — always visible */}
        <ToggleButtonGroup
          value={unit}
          exclusive
          onChange={handleUnitChange}
          size="small"
          sx={toggleGroupSx}
        >
          {UNIT_OPTIONS.map((u) => (
            <ToggleButton key={u.value} value={u.value}>
              {u.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* "..." → options popover */}
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          title="Options de la cote"
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
            title="Appliquer ces réglages aux cotes déjà créées"
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
        <Box sx={{ width: 268 }}>
          {/* preview header */}
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
              Aperçu 2D
            </Typography>
            <Button size="small" onClick={handleReset}>
              Réinit.
            </Button>
          </Box>

          {/* live 2D preview */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              bgcolor: "background.default",
              py: 1.5,
            }}
          >
            <svg width={220} height={svgH}>
              {/* measured object */}
              <rect
                x={x1}
                y={barY}
                width={x2 - x1}
                height={barH}
                rx={2}
                fill="#e2795b"
              />
              {/* dashed extension lines */}
              {previewExt > 0.5 && (
                <>
                  <line
                    x1={x1}
                    y1={clickY}
                    x2={x1}
                    y2={dimY}
                    stroke={strokeColor}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={x2}
                    y1={clickY}
                    x2={x2}
                    y2={dimY}
                    stroke={strokeColor}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                </>
              )}
              {/* dimension line + end ticks */}
              <line
                x1={x1}
                y1={dimY}
                x2={x2}
                y2={dimY}
                stroke={strokeColor}
                strokeWidth={1}
              />
              <line
                x1={x1}
                y1={dimY - 4}
                x2={x1}
                y2={dimY + 4}
                stroke={strokeColor}
                strokeWidth={1}
              />
              <line
                x1={x2}
                y1={dimY - 4}
                x2={x2}
                y2={dimY + 4}
                stroke={strokeColor}
                strokeWidth={1}
              />
              {/* value label */}
              <text
                x={(x1 + x2) / 2}
                y={dimY + 6}
                textAnchor="middle"
                dominantBaseline="hanging"
                fontSize={previewFontSize}
                fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                fill={strokeColor}
              >
                {previewShowLabel && (
                  <tspan fontStyle="italic">Libellé = </tspan>
                )}
                {previewText}
              </text>
            </svg>
          </Box>

          {/* options */}
          <Box
            sx={{
              px: 1.5,
              "& > *": { borderTop: "1px solid", borderColor: "divider" },
              "& > *:first-of-type": { borderTop: "none" },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 1,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                Décalage extrémités
              </Typography>
              <InputBase
                type="number"
                value={extensionOffset ?? ""}
                onChange={(e) => handleExtensionOffsetChange(e.target.value)}
                endAdornment={
                  <Typography variant="caption" color="text.secondary">
                    px
                  </Typography>
                }
                sx={numberInputSx}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 1,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                Taille du texte
              </Typography>
              <InputBase
                type="number"
                value={fontSize ?? ""}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                endAdornment={
                  <Typography variant="caption" color="text.secondary">
                    px
                  </Typography>
                }
                sx={numberInputSx}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 1,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                Décimales
              </Typography>
              <ToggleButtonGroup
                value={decimals}
                exclusive
                onChange={handleDecimalsChange}
                size="small"
                sx={toggleGroupSx}
              >
                {DECIMALS_OPTIONS.map((d) => (
                  <ToggleButton key={d} value={d} sx={{ minWidth: 28 }}>
                    {d}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 0.5,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                Afficher l&apos;unité après la valeur
              </Typography>
              <Switch
                size="small"
                checked={Boolean(showUnitLabel)}
                onChange={handleShowUnitLabelChange}
              />
            </Box>

            {showTotalOption && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  py: 0.5,
                }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  Cote totale
                </Typography>
                <Switch
                  size="small"
                  checked={Boolean(showTotalCote)}
                  onChange={handleShowTotalCoteChange}
                />
              </Box>
            )}

            {showLabelOption && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  py: 0.5,
                }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  Afficher le libellé
                </Typography>
                <Switch
                  size="small"
                  checked={Boolean(showRulerLabel)}
                  onChange={handleShowRulerLabelChange}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Popover>
    </WhiteSectionGeneric>
  );
}
