import { useSelector } from "react-redux";

import { Box } from "@mui/material";
import ButtonAppVersion from "App/components/ButtonAppVersion";
import ButtonDialogAppConfig from "Features/appConfig/components/ButtonDialogAppConfig";
import HelperClickInBgPosition from "Features/mapEditor/components/HelperClickInBgPosition";

export default function BottomBarDesktop() {
  // data

  const height = useSelector((s) => s.layout.bottomBarHeightDesktop);

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        height,
        minHeight: height,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 100,
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <ButtonAppVersion />
        <ButtonDialogAppConfig />
      </Box>

      <HelperClickInBgPosition />
    </Box>
  );
}
