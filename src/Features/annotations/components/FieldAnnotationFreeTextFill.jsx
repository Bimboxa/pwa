import { Box, Typography, Divider, Switch } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ColorDot from "./ColorDot";

// strings

const titleS = "Remplissage";
const fillColorS = "Couleur de remplissage";
const paddingS = "Marge intérieure";

const rowSx = { display: "flex", alignItems: "center", gap: 1 };

// FREE_TEXT "Remplissage" card: background color + on/off, inner padding.
export default function FieldAnnotationFreeTextFill({ value, onChange }) {
  const {
    fillColor = "#ffffff",
    hasBackground = true,
    hasPadding = true,
  } = value ?? {};

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={rowSx}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {titleS}
          </Typography>
          <ColorDot
            value={fillColor}
            onChange={(color) => onChange({ fillColor: color })}
            title={fillColorS}
            disabled={!hasBackground}
          />
          <Switch
            size="small"
            checked={Boolean(hasBackground)}
            onChange={(e) => onChange({ hasBackground: e.target.checked })}
          />
        </Box>

        <Divider />

        <Box sx={rowSx}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {paddingS}
          </Typography>
          <Switch
            size="small"
            checked={Boolean(hasPadding)}
            onChange={(e) => onChange({ hasPadding: e.target.checked })}
          />
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
