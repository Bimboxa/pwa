import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelTitle from "Features/layout/components/PanelTitle";
import ButtonInPanelResetBaseMapPose from "Features/mapEditor/components/ButtonInPanelResetBaseMapPose";

export default function PanelFormatMainBaseMap() {
  const mainBaseMap = useMainBaseMap();

  const title = "Fond de plan";
  return (
    <BoxFlexVStretch>
      <Box sx={{ px: 1 }}>
        <Typography variant="caption">{mainBaseMap?.name}</Typography>
      </Box>
      <PanelTitle title={title} />
      <Box sx={{ p: 1, width: 1 }}>
        <ButtonInPanelResetBaseMapPose />
      </Box>
    </BoxFlexVStretch>
  );
}
