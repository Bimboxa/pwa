import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ColorDot from "./ColorDot";

import { toggleGroupSx } from "Features/annotations/constants/fieldSx";

// strings

const titleS = "Style";
const textColorS = "Couleur du texte";
const boldS = "Gras";
const italicS = "Italique";
const underlineS = "Souligné";

// FREE_TEXT "Style" card: text color + bold / italic / underline.
export default function FieldAnnotationFreeTextStyle({ value, onChange }) {
  const {
    textColor = "#000000",
    fontWeight = "normal",
    fontItalic = false,
    fontUnderline = false,
  } = value ?? {};

  // helpers

  const styleValues = [
    ...(fontWeight === "bold" ? ["bold"] : []),
    ...(fontItalic ? ["italic"] : []),
    ...(fontUnderline ? ["underline"] : []),
  ];

  // handlers

  function handleStyleChange(e, newValues) {
    onChange({
      fontWeight: newValues.includes("bold") ? "bold" : "normal",
      fontItalic: newValues.includes("italic"),
      fontUnderline: newValues.includes("underline"),
    });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {titleS}
        </Typography>
        <ColorDot
          value={textColor}
          onChange={(color) => onChange({ textColor: color })}
          title={textColorS}
        />
        <ToggleButtonGroup
          value={styleValues}
          onChange={handleStyleChange}
          size="small"
          sx={toggleGroupSx}
        >
          <ToggleButton value="bold" title={boldS}>
            <FormatBold fontSize="small" />
          </ToggleButton>
          <ToggleButton value="italic" title={italicS}>
            <FormatItalic fontSize="small" />
          </ToggleButton>
          <ToggleButton value="underline" title={underlineS}>
            <FormatUnderlined fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </WhiteSectionGeneric>
  );
}
