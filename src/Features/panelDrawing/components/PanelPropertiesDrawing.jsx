import { useDispatch, useSelector } from "react-redux";
import { setShowLayers } from "Features/popperMapListings/popperMapListingsSlice";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import RowSwitchConfig from "Features/scopeConfig/components/RowSwitchConfig";
import SectionBaseMapOverview from "Features/baseMaps/components/SectionBaseMapOverview";
import SectionDrawingListings from "./SectionDrawingListings";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

// ---------------------------------------------------------------------------
// PanelPropertiesDrawing — default properties panel of the Dessin module
// (empty selection): main base map overview + opacity, the scope's listings
// with their visibility, and the layers toggle of the floating popper.
// ---------------------------------------------------------------------------

export default function PanelPropertiesDrawing() {
  // strings

  const moduleS = "Dessin";
  const layersTitleS = "Calques";
  const layersLabelS = "Travailler avec des calques";
  const layersCaptionS =
    "Les calques apparaissent dans le panneau d'annotations flottant.";

  // data

  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const showLayers = useSelector((s) => s.popperMapListings.showLayers);

  // helpers

  const titleS = baseMap?.name ?? baseMap?.label ?? "Fond de plan";

  // handlers

  function handleToggleLayers() {
    dispatch(setShowLayers(!showLayers));
  }

  // render

  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      {/* Header */}
      <Box sx={{ p: 0.5, pl: 2, minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{
            fontStyle: "italic",
            fontSize: (theme) => theme.typography.caption.fontSize,
          }}
        >
          {moduleS}
        </Typography>
        <Typography noWrap variant="body2" sx={{ fontWeight: "bold" }}>
          {titleS}
        </Typography>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        <SectionBaseMapOverview returnFromViewer="MAP" />

        <SectionDrawingListings />

        <WhiteSectionGeneric>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
            {layersTitleS}
          </Typography>
          <RowSwitchConfig
            label={layersLabelS}
            caption={layersCaptionS}
            checked={Boolean(showLayers)}
            onChange={handleToggleLayers}
          />
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
