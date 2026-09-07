import { Box, Typography, Divider, Switch } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ColorDot from "./ColorDot";

// strings

const titleS = "Bordure";
const borderColorS = "Couleur de la bordure";
const connectorS = "Trait de connexion";

const rowSx = { display: "flex", alignItems: "center", gap: 1 };

// FREE_TEXT "Bordure" card: border color + on/off, leader line toggle.
export default function FieldAnnotationFreeTextBorder({ value, onChange }) {
  const {
    borderColor = "#000000",
    hasBorder = false,
    hasConnector = false,
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
            value={borderColor}
            onChange={(color) => onChange({ borderColor: color })}
            title={borderColorS}
            disabled={!hasBorder}
          />
          <Switch
            size="small"
            checked={Boolean(hasBorder)}
            onChange={(e) => onChange({ hasBorder: e.target.checked })}
          />
        </Box>

        <Divider />

        <Box sx={rowSx}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {connectorS}
          </Typography>
          <Switch
            size="small"
            checked={Boolean(hasConnector)}
            onChange={(e) => onChange({ hasConnector: e.target.checked })}
          />
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
