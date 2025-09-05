import { Box } from "@mui/material";

import ButtonDialogAppConfig from "Features/appConfig/components/ButtonDialogAppConfig";

export default function PageDashboardFooter() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        bgcolor: "white",
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        p: 1,
      }}
    >
      <ButtonDialogAppConfig />
    </Box>
  );
}
