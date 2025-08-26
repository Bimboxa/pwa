import { Box, Paper } from "@mui/material";
import ButtonDialogAppConfig from "Features/appConfig/components/ButtonDialogAppConfig";

export default function BottomBarDesktop() {
  return (
    <Box
      sx={{
        bgcolor: "white",
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        height: 42,
        display: "flex",
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <ButtonDialogAppConfig />
    </Box>
  );
}
