import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxCenter from "Features/layout/components/BoxCenter";

import { Typography, Box } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";

export default function SectionDetailSearchProject() {
  // data

  const appConfig = useAppConfig();

  // helpers

  const title = appConfig?.strings?.project.select ?? "Sélectionnez un projet";

  // render

  return (
    <BoxFlexVStretch>
      <BoxCenter>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <ArrowBack />
          <Typography sx={{ ml: 2 }} variant="h4">
            {title}
          </Typography>
        </Box>
      </BoxCenter>
    </BoxFlexVStretch>
  );
}
