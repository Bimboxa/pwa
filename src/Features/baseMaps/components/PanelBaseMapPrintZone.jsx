import { Box, IconButton, Typography } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionBaseMapPrintZone from "./SectionBaseMapPrintZone";

// « Zone d'impression » sub-panel of PanelBaseMapProperties (view
// "printZone"): header with a back arrow to the base map properties, then
// the print zone fields. Opened from the base map panel row, or directly by
// a click on the sheet frame in the map editor (propertiesRequestedView).
export default function PanelBaseMapPrintZone({ baseMap, onBack }) {
  // strings

  const parentS = "Fond de plan";
  const titleS = "Zone d'impression";

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={onBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {parentS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {titleS}
          </Typography>
        </Box>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1.5 }}>
        <SectionBaseMapPrintZone baseMap={baseMap} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
