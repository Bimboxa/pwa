import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import { toggleGroupSx } from "Features/annotations/constants/fieldSx";

// strings

const titleS = "Alignement";

const ALIGN_OPTIONS = [
  { value: "LEFT", icon: <FormatAlignLeft fontSize="small" /> },
  { value: "CENTER", icon: <FormatAlignCenter fontSize="small" /> },
  { value: "RIGHT", icon: <FormatAlignRight fontSize="small" /> },
];

// FREE_TEXT "Alignement" card: text alignment (LEFT / CENTER / RIGHT).
// `value` is the annotation, `onChange` receives a partial patch.
export default function FieldAnnotationFreeTextAlign({ value, onChange }) {
  const { textAlign = "LEFT" } = value ?? {};

  // handlers

  function handleChange(e, newAlign) {
    if (newAlign !== null) onChange({ textAlign: newAlign });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {titleS}
        </Typography>
        <ToggleButtonGroup
          value={textAlign}
          exclusive
          onChange={handleChange}
          size="small"
          sx={toggleGroupSx}
        >
          {ALIGN_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value}>
              {o.icon}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </WhiteSectionGeneric>
  );
}
