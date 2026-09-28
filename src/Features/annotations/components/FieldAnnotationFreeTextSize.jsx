import {
  Box,
  Typography,
  Divider,
  InputBase,
  Select,
  MenuItem,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import { FREE_TEXT_FONT_OPTIONS } from "Features/annotations/constants/freeTextConstants";
import { numberInputSx } from "Features/annotations/constants/fieldSx";

// strings

const titleS = "Taille";
const fontFamilyS = "Police";
const fontSizeS = "Taille du texte";

const DEFAULT_FONT_SIZE = 14;

const rowSx = { display: "flex", alignItems: "center", gap: 1 };

// FREE_TEXT "Taille" card: font family and text size (page pt, shown as
// px). The pt → image-px scale comes from the base map's print zone
// (« Zone d'impression »), or the legacy A4 long-side rule without one.
export default function FieldAnnotationFreeTextSize({ value, onChange }) {
  const { fontFamily = "Roboto", fontSize = DEFAULT_FONT_SIZE } = value ?? {};

  // handlers

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? DEFAULT_FONT_SIZE : Number(raw);
    onChange({
      fontSize:
        Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FONT_SIZE,
    });
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
      </Box>
    </WhiteSectionGeneric>
  );
}
