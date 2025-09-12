import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography } from "@mui/material";

export default function SectionDashboardTitle() {
  // data

  const appConfig = useAppConfig();

  // helpers

  const title = appConfig?.strings?.scope?.dashboardTitle ?? "Dossiers";

  return (
    <Box sx={{ pt: 4, pl: 4 }}>
      <Typography variant="h1">{title}</Typography>
    </Box>
  );
}
