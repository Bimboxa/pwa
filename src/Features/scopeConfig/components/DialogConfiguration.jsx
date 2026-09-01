import { useSelector, useDispatch } from "react-redux";

import { setOpenAppConfig } from "Features/appConfig/appConfigSlice";

import { Box, Button, Dialog, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";

import PanelConfiguration from "./PanelConfiguration";

// Full-screen configuration dialog — single global mount (MainApp). Every
// entry point (left-band "Configuration" button, org-name buttons, mobile
// "Config." nav, selector-page gear) opens it through the shared
// openAppConfig flag.
export default function DialogConfiguration() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.appConfig.openAppConfig);

  // handlers

  function handleClose() {
    dispatch(setOpenAppConfig(false));
  }

  // render

  return (
    <Dialog fullScreen open={open} onClose={handleClose} disableEnforceFocus>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1,
          bgcolor: "background.default",
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6">Configuration</Typography>
        <Button
          onClick={handleClose}
          variant="outlined"
          startIcon={<Close />}
          size="small"
        >
          Quitter
        </Button>
      </Box>
      <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        <PanelConfiguration onClose={handleClose} />
      </Box>
    </Dialog>
  );
}
