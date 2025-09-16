import { Box, Paper } from "@mui/material";
import ButtonDialogAppConfig from "Features/appConfig/components/ButtonDialogAppConfig";
import HelperClickInBgPosition from "Features/mapEditor/components/HelperClickInBgPosition";

export default function BottomBarDesktop() {
  return (
    <Box
      sx={{
        bgcolor: "white",
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        height: 42,
        minHeight: 42,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 100,
      }}
    >
      <ButtonDialogAppConfig />
      <HelperClickInBgPosition />
    </Box>
  );
}
