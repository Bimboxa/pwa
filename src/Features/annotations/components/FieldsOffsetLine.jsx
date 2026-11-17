import { Box, Typography, IconButton, InputBase, Switch } from "@mui/material";
import { SwapVert as SwapIcon } from "@mui/icons-material";

import {
  DEFAULT_OFFSET_LINE_FONT_SIZE_PT,
  DEFAULT_OFFSET_LINE_OFFSET_PT,
} from "Features/annotations/utils/getAnnotationOffsetLineConfig";

// strings

const offsetS = "Déport";
const flipS = "Inverser le côté";
const fontSizeS = "Taille du texte";
const showLabelS = "Libellé le long de la ligne";
const hintS =
  "Déport et taille du texte en points de la zone d'impression du fond de plan.";

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

const rowSx = { display: "flex", alignItems: "center", gap: 1 };

// Rows of the "Ligne de déport" section shared by the annotation and the
// annotation template panels: offset (absolute value + side flip), label
// switch and text size. `config` is the resolved offset line
// (getAnnotationOffsetLineConfig), `onChange` receives the changed keys only.
export default function FieldsOffsetLine({ config, onChange, disabled }) {
  // helpers

  const { offset, fontSize, showLabel } = config;
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

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? DEFAULT_OFFSET_LINE_FONT_SIZE_PT : Number(raw);
    onChange({
      fontSize:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_OFFSET_LINE_FONT_SIZE_PT,
    });
  }

  function handleShowLabelChange(e) {
    onChange({ showLabel: e.target.checked });
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
          {showLabelS}
        </Typography>
        <Switch
          size="small"
          checked={showLabel}
          onChange={handleShowLabelChange}
        />
      </Box>

      {showLabel && (
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
