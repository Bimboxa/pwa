import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setOpenAppConfig } from "Features/appConfig/appConfigSlice";

import { Box, Button, Dialog, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";

import PanelConfiguration from "./PanelConfiguration";

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

// Full-screen configuration dialog — single global mount (MainApp). Every
// entry point (left-band "Configuration" button, org-name buttons, mobile
// "Config." nav, selector-page gear) opens it through the shared
// openAppConfig flag.
//
// Closes on the plain "Q" key (hint shown in the Quitter button); Escape stays
// handled by MUI's onClose.
export default function DialogConfiguration() {
  const dispatch = useDispatch();

  // strings

  const hotkeyQ = "Q";

  // data

  const open = useSelector((s) => s.appConfig.openAppConfig);

  // handlers

  function handleClose() {
    dispatch(setOpenAppConfig(false));
  }

  // effects

  // "Q" closes the dialog. Capture-phase window listener, attached only while
  // open (the dialog is mounted with disableEnforceFocus so the focus may sit
  // on body). Yields while typing in a field and while a nested MUI dialog
  // (e.g. the "Supprimer les données" confirm) sits on top.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key?.toLowerCase() !== "q") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isEditableTarget(e.target)) return;
      if (document.querySelectorAll(".MuiDialog-root").length > 1) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dispatch(setOpenAppConfig(false));
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open]);

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
          <Typography
            variant="caption"
            sx={{
              ml: 1,
              fontSize: "0.6rem",
              lineHeight: 1,
              px: 0.5,
              py: 0.25,
              border: "1px solid currentColor",
              borderRadius: 0.5,
              opacity: 0.7,
              whiteSpace: "nowrap",
            }}
          >
            {hotkeyQ}
          </Typography>
        </Button>
      </Box>
      <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        <PanelConfiguration onClose={handleClose} />
      </Box>
    </Dialog>
  );
}
