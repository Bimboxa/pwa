import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionSelectedEntityZones from "./SectionSelectedEntityZones";

export default function PanelEntityZones() {
  // data

  const { value: entity } = useSelectedEntity();

  console.log("debug_1411_entity", entity);

  // helper - title

  const title = entity?.label ?? "-";

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 1 }}>
        <Typography variant="body2">{title}</Typography>
      </Box>
      <BoxFlexVStretch>
        <SectionSelectedEntityZones />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
