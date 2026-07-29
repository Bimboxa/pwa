import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SectionCaptureFormat from "Features/mapEditor/components/SectionCaptureFormat";
import SectionCaptureLegend from "Features/mapEditor/components/SectionCaptureLegend";
import SectionCaptureOptions from "Features/mapEditor/components/SectionCaptureOptions";
import SectionCaptureTitle from "Features/mapEditor/components/SectionCaptureTitle";
import SectionPovLogo from "./SectionPovLogo";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

// "Cadrage" tab content of the POV properties panels (selected POV and
// "Nouveau point de vue") and of the capture tool (PanelCaptureTool): white
// sections driving the shared imageMode state — Image (format + white
// background + border), Titre (description banner), Légende (visibility,
// size, quantities) and Logo. `children` are appended at the end of the
// scroll column (the capture tool adds its Étiquettes section there).
export default function SectionPovCadrage({ children }) {
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

      {/* brings its own white section: the whole block disappears when the
          org has no logo configured */}
      <SectionPovLogo />

      {children}
    </Box>
  );
}
