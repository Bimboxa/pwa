import { Box } from "@mui/material";

import ButtonDialogAppConfig from "Features/appConfig/components/ButtonDialogAppConfig";
import ButtonLoadKrtoFile from "Features/krtoFile/components/ButtonLoadKrtoFile";
import ButtonAppVersion from "App/components/ButtonAppVersion";
import ButtonSigninV2 from "Features/auth/components/ButtonSigninV2";
import IconButtonDebugAuth from "Features/auth/components/IconButtonDebugAuth";


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
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <ButtonSigninV2 />
        <ButtonAppVersion />
        <ButtonDialogAppConfig />
        <IconButtonDebugAuth />
      </Box>

      <div>
        <ButtonLoadKrtoFile />
      </div>

    </Box>
  );
}
