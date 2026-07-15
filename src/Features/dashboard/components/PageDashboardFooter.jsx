import { Box } from "@mui/material";

import ButtonDialogAppConfig from "Features/appConfig/components/ButtonDialogAppConfig";
import ButtonAppVersion from "App/components/ButtonAppVersion";
import ButtonSigninV2 from "Features/auth/components/ButtonSigninV2";
import IconButtonDebugAuth from "Features/auth/components/IconButtonDebugAuth";
import SwitchCoupledNavigation from "Features/layout/components/SwitchCoupledNavigation";

import { PAGE_BG, FOOTER_BORDER } from "../utils/dashboardStyles";

export default function PageDashboardFooter() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        bgcolor: PAGE_BG,
        borderTop: `1px solid ${FOOTER_BORDER}`,
        p: 1,
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <ButtonSigninV2 />
        <ButtonAppVersion />
        <ButtonDialogAppConfig />
        <IconButtonDebugAuth />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center" }}>
        <SwitchCoupledNavigation />
      </Box>

    </Box>
  );
}
