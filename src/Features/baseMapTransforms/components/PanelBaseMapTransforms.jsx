import { useDispatch, useSelector } from "react-redux";

import { setShowInBaseMapsViewer } from "Features/popperMapListings/popperMapListingsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, FormControlLabel, Switch, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SectionVersionTransforms from "Features/baseMaps/components/SectionVersionTransforms";

export default function PanelBaseMapTransforms() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const showDrawingTools = useSelector(
    (s) => s.popperMapListings.showInBaseMapsViewer
  );

  // helpers

  const activeVersion = baseMap?.getActiveVersion?.();

  // render

  if (!baseMap || !activeVersion) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Sélectionnez un fond de plan
        </Typography>
      </Box>
    );
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 0.5, pl: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Transformations
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {baseMap.name || "Fond de plan"}
        </Typography>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1.5 }}>
        <WhiteSectionGeneric>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Dessin
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            Dessiner des annotations et fusionner les ensuite sur l&apos;image
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <FormControlLabel
              sx={{ ml: 0 }}
              control={
                <Switch
                  size="small"
                  checked={showDrawingTools}
                  onChange={(e) =>
                    dispatch(setShowInBaseMapsViewer(e.target.checked))
                  }
                />
              }
              label={
                <Typography variant="body2">
                  Afficher les outils de dessin
                </Typography>
              }
            />
          </Box>
        </WhiteSectionGeneric>

        <SectionVersionTransforms
          baseMap={baseMap}
          versionId={activeVersion.id}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
