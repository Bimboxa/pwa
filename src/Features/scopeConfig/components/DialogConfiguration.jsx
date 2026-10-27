import { useSelector, useDispatch } from "react-redux";

import { setOpenAppConfig } from "Features/appConfig/appConfigSlice";

import { Box, Dialog } from "@mui/material";

import HeaderDialogFullPage from "Features/layout/components/HeaderDialogFullPage";
import useDialogQuitHotkey from "Features/layout/hooks/useDialogQuitHotkey";
import PanelConfiguration from "./PanelConfiguration";

// Full-screen configuration dialog — single global mount (MainApp). Every
// entry point (left-band "Configuration" button, org-name buttons, mobile
// "Config." nav, selector-page gear) opens it through the shared
// openAppConfig flag.
//
// Closes on the plain "Q" key (hint shown in the Quitter button,
// useDialogQuitHotkey); Escape stays handled by MUI's onClose.
export default function DialogConfiguration() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Configuration";

  // data

  const open = useSelector((s) => s.appConfig.openAppConfig);

  // handlers

  function handleClose() {
    dispatch(setOpenAppConfig(false));
  }

  // "Q" closes the dialog (the dialog is mounted with disableEnforceFocus so
  // the focus may sit on body — the hook listens on window).
  useDialogQuitHotkey(open, handleClose);

  // render

  return (
    <Dialog fullScreen open={open} onClose={handleClose} disableEnforceFocus>
      <HeaderDialogFullPage title={titleS} onClose={handleClose} />
      <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        <PanelConfiguration onClose={handleClose} />
      </Box>
    </Dialog>
  );
}
