import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectStartingDialogOpen,
  setOpenStartingDialog,
} from "../startingSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Dialog } from "@mui/material";

import HeaderDialogFullPage from "Features/layout/components/HeaderDialogFullPage";
import useDialogQuitHotkey from "Features/layout/hooks/useDialogQuitHotkey";
import PanelStarting from "./PanelStarting";

import getStartingVocabulary from "../utils/getStartingVocabulary";

// Full-page « Démarrer avec <appName> » dialog — single global mount (MainApp),
// opened by ButtonOpenStarting on the dashboard. Same shell as the
// Configuration dialog: header with « Quitter », Q closes it
// (useDialogQuitHotkey), Escape stays handled by MUI's onClose.
export default function DialogStarting() {
  const dispatch = useDispatch();

  // data

  const open = useSelector(selectStartingDialogOpen);
  const appConfig = useAppConfig();

  // strings

  const { startLabelS } = getStartingVocabulary(appConfig);

  // handlers

  const handleClose = useCallback(() => {
    dispatch(setOpenStartingDialog(false));
  }, [dispatch]);

  useDialogQuitHotkey(open, handleClose);

  // render

  return (
    <Dialog fullScreen open={open} onClose={handleClose} disableEnforceFocus>
      <HeaderDialogFullPage title={startLabelS} onClose={handleClose} />
      <PanelStarting />
    </Dialog>
  );
}
