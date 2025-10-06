import { Box } from "@mui/material";

import LogoApp from "App/components/LogoApp";

export default function PageDashboardHeader() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        bgcolor: "white",
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        p: 1,
      }}
    >
      <Box sx={{}}>
        <LogoApp />
      </Box>
    </Box>
  );
}
