import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setPovDraftDescription } from "../povSlice";

import { Box, Tab, Tabs, TextField, Typography } from "@mui/material";
import { PhotoCamera } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelPovFilters from "./PanelPovFilters";
import SectionPovCadrage from "./SectionPovCadrage";
import SectionPovAiEnhance from "./SectionPovAiEnhance";

// Default properties panel of the POV viewer (no POV selected): drives what
// the next "Créer une vue" will capture — Image (placeholder + draft
// description, no export yet), Cadrage (frame + legend + background) and
// Filtres (annotation templates visibility) tabs.
export default function PanelPovFrameProperties() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Point de vue";
  const titleS = "Nouveau point de vue";
  const descriptionS = "Description";
  const placeholderS = 'Cliquer sur "Créer une vue" dans l\'éditeur';

  // data

  const draftDescription = useSelector((s) => s.pov.draftDescription);

  // state

  const [tab, setTab] = useState("IMAGE");

  // handlers

  function handleDescriptionChange(e) {
    dispatch(setPovDraftDescription(e.target.value));
  }

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
        <Tab label="Image" value="IMAGE" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Cadrage" value="CADRAGE" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Filtres" value="FILTRES" sx={{ minHeight: 36, py: 0.5 }} />
      </Tabs>

      {tab === "FILTRES" && <PanelPovFilters />}

      {tab === "CADRAGE" && <SectionPovCadrage />}

      {tab === "IMAGE" && (
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
          {/* Placeholder: no capture yet */}
          <Box
            sx={{
              borderRadius: 1,
              bgcolor: "action.hover",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 120,
              p: 2,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center" }}
            >
              {placeholderS}
            </Typography>
          </Box>

          {/* Draft description, consumed by the next "Créer une vue" */}
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            label={descriptionS}
            value={draftDescription}
            onChange={handleDescriptionChange}
          />

          {/* AI enhancement of the next created view */}
          <SectionPovAiEnhance />
        </Box>
      )}
    </BoxFlexVStretch>
  );
}
