import {
  Box,
  Typography,
  Divider,
  InputBase,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import {
  FREE_TEXT_FONT_OPTIONS,
  FREE_TEXT_PAGE_FORMATS,
} from "Features/annotations/constants/freeTextConstants";
import {
  toggleGroupSx,
  numberInputSx,
} from "Features/annotations/constants/fieldSx";

// strings

const titleS = "Taille";
const fontFamilyS = "Police";
const fontSizeS = "Taille du texte";
const pageFormatS = "Format de la page";

const DEFAULT_FONT_SIZE = 14;

const rowSx = { display: "flex", alignItems: "center", gap: 1 };

// FREE_TEXT "Taille" card: font family, text size (page pt, shown as px)
// and the A4 / A3 page format the size refers to.
export default function FieldAnnotationFreeTextSize({ value, onChange }) {
  const {
    fontFamily = "Roboto",
    fontSize = DEFAULT_FONT_SIZE,
    pageFormat = "A4",
  } = value ?? {};

  // handlers

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? DEFAULT_FONT_SIZE : Number(raw);
    onChange({
      fontSize:
        Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FONT_SIZE,
    });
  }

  function handlePageFormatChange(e, newFormat) {
    if (newFormat !== null) onChange({ pageFormat: newFormat });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {titleS}
        </Typography>

        <Box sx={rowSx}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {fontFamilyS}
          </Typography>
          <Select
            value={fontFamily}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
            size="small"
            variant="standard"
            disableUnderline
            sx={{ fontSize: "0.8rem", minWidth: 130 }}
          >
            {FREE_TEXT_FONT_OPTIONS.map((o) => (
              <MenuItem
                key={o.key}
                value={o.key}
                sx={{ fontFamily: o.stack, fontSize: "0.85rem" }}
              >
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Divider />

        <Box sx={rowSx}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {fontSizeS}
          </Typography>
          <InputBase
            type="number"
            value={fontSize ?? ""}
            onChange={(e) => handleFontSizeChange(e.target.value)}
            inputProps={{ min: 1, step: 1 }}
            endAdornment={
              <Typography variant="caption" color="text.secondary">
                px
              </Typography>
            }
            sx={numberInputSx}
          />
        </Box>

        <Divider />

        {/* The size is in PDF points as if the base map filled this page:
            pick the format the plan will be exported on. */}
        <Box sx={rowSx}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {pageFormatS}
          </Typography>
          <ToggleButtonGroup
            value={pageFormat}
            exclusive
            onChange={handlePageFormatChange}
            size="small"
            sx={toggleGroupSx}
          >
            {FREE_TEXT_PAGE_FORMATS.map((f) => (
              <ToggleButton key={f.key} value={f.key}>
                {f.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
