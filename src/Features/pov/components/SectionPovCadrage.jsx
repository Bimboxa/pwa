import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SectionCaptureFormat from "Features/mapEditor/components/SectionCaptureFormat";
import SectionCaptureLegend from "Features/mapEditor/components/SectionCaptureLegend";
import SectionCaptureOptions from "Features/mapEditor/components/SectionCaptureOptions";
import SectionCaptureTitle from "Features/mapEditor/components/SectionCaptureTitle";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

// "Cadrage" tab content of the POV properties panels (selected POV and
// "Nouveau point de vue"): white sections driving the shared imageMode
// state — Image (format + white background + border), Titre (description
// banner) and Légende (visibility, size, quantities).
export default function SectionPovCadrage() {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        p: 1,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <WhiteSectionGeneric>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography variant="overline" sx={LABEL_SX}>
            Image
          </Typography>
          <SectionCaptureFormat />
          <SectionCaptureOptions />
        </Box>
      </WhiteSectionGeneric>

      <WhiteSectionGeneric>
        <SectionCaptureTitle />
      </WhiteSectionGeneric>

      <WhiteSectionGeneric>
        <SectionCaptureLegend />
      </WhiteSectionGeneric>
    </Box>
  );
}
