import { useState } from "react";

import { Box, Tab, Tabs, Typography } from "@mui/material";
import { PhotoCamera } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SectionCaptureFormat from "Features/mapEditor/components/SectionCaptureFormat";
import SectionCaptureLegend from "Features/mapEditor/components/SectionCaptureLegend";
import PanelPovFilters from "./PanelPovFilters";

// Default properties panel of the POV viewer (no POV selected): drives what
// the next "Créer une vue" will capture — Cadrage (frame + legend, shared
// imageMode state read by ImageModeOverlay in 2D and 3D) and Filtres
// (annotation templates visibility) tabs.
export default function PanelPovFrameProperties() {
  // strings

  const captionS = "Point de vue";
  const titleS = "Nouveau point de vue";

  // state

  const [tab, setTab] = useState("CADRAGE");

  // render

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <PhotoCamera
          fontSize="small"
          sx={{ mx: 1, color: "text.secondary" }}
        />
        <Box>
          <Typography variant="caption" color="text.secondary">
            {captionS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {titleS}
          </Typography>
        </Box>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tab label="Cadrage" value="CADRAGE" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Filtres" value="FILTRES" sx={{ minHeight: 36, py: 0.5 }} />
      </Tabs>

      {tab === "FILTRES" && <PanelPovFilters />}

      {tab === "CADRAGE" && (
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
              <SectionCaptureFormat />
              <SectionCaptureLegend />
            </Box>
          </WhiteSectionGeneric>
        </Box>
      )}
    </BoxFlexVStretch>
  );
}
