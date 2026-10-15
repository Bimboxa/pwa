import {
  Box,
  Typography,
  Switch,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import { toggleGroupSx } from "Features/annotations/constants/fieldSx";
import {
  DEFAULT_SLOPE_FONT_SIZE,
  SLOPE_FONT_SIZES,
  getSlopeFontSizePt,
} from "Features/annotations/constants/slopeFontSizeConstants";

// strings

const titleS = "Pente";
const showS = "Afficher la pente";
const fontSizeS = "Taille du texte";

// Template-level slope indicator settings (POLYGON): visibility (stored as
// `hideSlope`) + font size of the « x% » label (`slopeFontSize`, page pt of
// the print zone). Both are always applied to the annotations (no padlock).
export default function FieldAnnotationTemplateSlope({
  annotationTemplate,
  onChange,
}) {
  // data

  const showSlope = !annotationTemplate?.hideSlope;
  const fontSize = SLOPE_FONT_SIZES.some(
    (s) => s.key === annotationTemplate?.slopeFontSize
  )
    ? annotationTemplate.slopeFontSize
    : DEFAULT_SLOPE_FONT_SIZE;
  const fontSizePt = getSlopeFontSizePt(fontSize);

  // handlers

  function handleShowSlopeChange(e) {
    onChange({ ...annotationTemplate, hideSlope: !e.target.checked });
  }

  function handleFontSizeChange(e, newFontSize) {
    if (newFontSize !== null)
      onChange({ ...annotationTemplate, slopeFontSize: newFontSize });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {titleS}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {showS}
          </Typography>
          <Switch
            size="small"
            checked={showSlope}
            onChange={handleShowSlopeChange}
          />
        </Box>

        {showSlope && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {fontSizeS}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {`${fontSizePt} pt`}
            </Typography>
            <ToggleButtonGroup
              value={fontSize}
              exclusive
              onChange={handleFontSizeChange}
              size="small"
              sx={toggleGroupSx}
            >
              {SLOPE_FONT_SIZES.map((s) => (
                <ToggleButton key={s.key} value={s.key}>
                  {s.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
