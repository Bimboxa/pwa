import {
  Box,
  Typography,
  IconButton,
  InputBase,
  Switch,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { SwapVert as SwapIcon } from "@mui/icons-material";

import {
  DEFAULT_OFFSET_LINE_FONT_SIZE_PT,
  DEFAULT_OFFSET_LINE_OFFSET_PT,
  DEFAULT_OFFSET_LINE_STROKE_WIDTH_PT,
  OFFSET_LINE_LABEL_SOURCE_ANNOTATION,
  OFFSET_LINE_LABEL_SOURCE_NONE,
  OFFSET_LINE_LABEL_SOURCE_TEMPLATE,
} from "Features/annotations/utils/getAnnotationOffsetLineConfig";

// strings

const offsetS = "Déport";
const flipS = "Inverser le côté";
const strokeWidthS = "Épaisseur";
const dashedS = "Pointillé";
const fontSizeS = "Taille du texte";
const labelSourceS = "Libellé le long de la ligne";
const showLengthS = "Longueur du segment";
const unitS = "Unité";
const decimalsS = "Décimales";
const showLengthUnitS = "Afficher l'unité";
const hintS =
  "Déport, épaisseur et taille du texte en points de la zone d'impression du fond de plan.";

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

const UNIT_OPTIONS = [
  { value: "CM", label: "cm" },
  { value: "M", label: "m" },
];

const LABEL_SOURCE_OPTIONS = [
  { value: OFFSET_LINE_LABEL_SOURCE_TEMPLATE, label: "Modèle" },
  { value: OFFSET_LINE_LABEL_SOURCE_ANNOTATION, label: "Annotation" },
];

const DECIMALS_OPTIONS = [0, 1, 2];

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

const rowSx = { display: "flex", alignItems: "center", gap: 1 };

// Rows of the "Ligne de déport" section shared by the annotation and the
// annotation template panels: offset (absolute value + side flip), line
// style (thickness, dashed), text
// content (label and / or segment length, formatted like a cote) and text
// size. `config` is the resolved offset line
// (getAnnotationOffsetLineConfig), `onChange` receives the changed keys only.
export default function FieldsOffsetLine({ config, onChange, disabled }) {
  // helpers

  const {
    offset,
    strokeWidth,
    dashed,
    fontSize,
    labelSource,
    showLength,
    lengthUnit,
    lengthDecimals,
    showLengthUnit,
  } = config;
  const hasText = labelSource !== OFFSET_LINE_LABEL_SOURCE_NONE || showLength;
  const side = offset < 0 ? -1 : 1;

  // handlers

  function handleOffsetChange(raw) {
    const parsed = raw === "" ? DEFAULT_OFFSET_LINE_OFFSET_PT : Number(raw);
    const value =
      Number.isFinite(parsed) && parsed >= 0
        ? parsed
        : DEFAULT_OFFSET_LINE_OFFSET_PT;
    onChange({ offset: side * value });
  }

  function handleFlip() {
    onChange({ offset: -offset });
  }

  function handleStrokeWidthChange(raw) {
    const parsed =
      raw === "" ? DEFAULT_OFFSET_LINE_STROKE_WIDTH_PT : Number(raw);
    onChange({
      strokeWidth:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_OFFSET_LINE_STROKE_WIDTH_PT,
    });
  }

  function handleDashedChange(e) {
    onChange({ dashed: e.target.checked });
  }

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? DEFAULT_OFFSET_LINE_FONT_SIZE_PT : Number(raw);
    onChange({
      fontSize:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_OFFSET_LINE_FONT_SIZE_PT,
    });
  }

  // One source or none: clicking the active button again (null) turns the
  // label off. `showLabel` is the legacy switch, dropped on the first edit.
  function handleLabelSourceChange(e, value) {
    onChange({
      labelSource: value ?? OFFSET_LINE_LABEL_SOURCE_NONE,
      showLabel: undefined,
    });
  }

  function handleShowLengthChange(e) {
    onChange({ showLength: e.target.checked });
  }

  // Exclusive groups hand back null when the active button is clicked again.
  function handleLengthUnitChange(e, value) {
    if (value) onChange({ lengthUnit: value });
  }

  function handleLengthDecimalsChange(e, value) {
    if (value !== null) onChange({ lengthDecimals: value });
  }

  function handleShowLengthUnitChange(e) {
    onChange({ showLengthUnit: e.target.checked });
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        ...(disabled && { opacity: 0.5, pointerEvents: "none" }),
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {hintS}
      </Typography>

      <Box sx={rowSx}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {offsetS}
        </Typography>
        <IconButton size="small" onClick={handleFlip} title={flipS}>
          <SwapIcon fontSize="small" />
        </IconButton>
        <InputBase
          type="number"
          value={Math.abs(offset)}
          onChange={(e) => handleOffsetChange(e.target.value)}
          inputProps={{ min: 0, step: 1 }}
          endAdornment={
            <Typography variant="caption" color="text.secondary">
              pt
            </Typography>
          }
          sx={numberInputSx}
        />
      </Box>

      <Box sx={rowSx}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {strokeWidthS}
        </Typography>
        <InputBase
          type="number"
          value={strokeWidth}
          onChange={(e) => handleStrokeWidthChange(e.target.value)}
          inputProps={{ min: 0.25, step: 0.25 }}
          endAdornment={
            <Typography variant="caption" color="text.secondary">
              pt
            </Typography>
          }
          sx={numberInputSx}
        />
      </Box>

      <Box sx={rowSx}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {dashedS}
        </Typography>
        <Switch size="small" checked={dashed} onChange={handleDashedChange} />
      </Box>

      <Box sx={rowSx}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {labelSourceS}
        </Typography>
        <ToggleButtonGroup
          value={labelSource}
          exclusive
          onChange={handleLabelSourceChange}
          size="small"
          sx={toggleGroupSx}
        >
          {LABEL_SOURCE_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Box sx={rowSx}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {showLengthS}
        </Typography>
        <Switch
          size="small"
          checked={showLength}
          onChange={handleShowLengthChange}
        />
      </Box>

      {showLength && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pl: 1.5 }}>
          <Box sx={rowSx}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {unitS}
            </Typography>
            <ToggleButtonGroup
              value={lengthUnit}
              exclusive
              onChange={handleLengthUnitChange}
              size="small"
              sx={toggleGroupSx}
            >
              {UNIT_OPTIONS.map((u) => (
                <ToggleButton key={u.value} value={u.value}>
                  {u.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box sx={rowSx}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {decimalsS}
            </Typography>
            <ToggleButtonGroup
              value={lengthDecimals}
              exclusive
              onChange={handleLengthDecimalsChange}
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

          <Box sx={rowSx}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {showLengthUnitS}
            </Typography>
            <Switch
              size="small"
              checked={showLengthUnit}
              onChange={handleShowLengthUnitChange}
            />
          </Box>
        </Box>
      )}

      {hasText && (
        <Box sx={rowSx}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {fontSizeS}
          </Typography>
          <InputBase
            type="number"
            value={fontSize}
            onChange={(e) => handleFontSizeChange(e.target.value)}
            inputProps={{ min: 1, step: 1 }}
            endAdornment={
              <Typography variant="caption" color="text.secondary">
                pt
              </Typography>
            }
            sx={numberInputSx}
          />
        </Box>
      )}
    </Box>
  );
}
