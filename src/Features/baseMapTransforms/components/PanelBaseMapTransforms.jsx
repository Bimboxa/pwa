import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionVersionTransforms from "Features/baseMaps/components/SectionVersionTransforms";
import SectionBaseMapAnnotations from "./SectionBaseMapAnnotations";
import SectionPhotoPlanQuickFlatten from "Features/photoPlans/components/SectionPhotoPlanQuickFlatten";

export default function PanelBaseMapTransforms() {
  // data

  const baseMap = useMainBaseMap();

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
        {baseMap?.isPhoto && <SectionPhotoPlanQuickFlatten baseMap={baseMap} />}
        <SectionBaseMapAnnotations baseMap={baseMap} />

        <SectionVersionTransforms
          baseMap={baseMap}
          versionId={activeVersion.id}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
