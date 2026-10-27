import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectStartingDialogOpen,
  selectStartingSectionKey,
  setOpenStartingDialog,
  setStartingSectionKey,
} from "../startingSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Dialog } from "@mui/material";

import useDialogQuitHotkey from "Features/layout/hooks/useDialogQuitHotkey";
import BackgroundDashboard from "Features/dashboard/components/BackgroundDashboard";
import HeaderStarting from "./HeaderStarting";
import PanelStarting from "./PanelStarting";

import { PAGE_BG } from "Features/dashboard/utils/dashboardStyles";
import getStartingVocabulary from "../utils/getStartingVocabulary";

// Full-page « Démarrer avec <appName> » dialog — single global mount (MainApp),
// opened by ButtonOpenStarting on the dashboard. Same backdrop as the
// dashboard so it reads as a continuation of it; the back arrow of its
// header, « Quitter », Q (useDialogQuitHotkey) and Escape (MUI onClose) all
// close it.
export default function DialogStarting() {
  const dispatch = useDispatch();

  // data

  const open = useSelector(selectStartingDialogOpen);
  const sectionKey = useSelector(selectStartingSectionKey);
  const appConfig = useAppConfig();

  // strings

  const { startLabelS } = getStartingVocabulary(appConfig);

  // handlers

  const handleClose = useCallback(() => {
    dispatch(setOpenStartingDialog(false));
  }, [dispatch]);

  function handleSelectSection(key) {
    dispatch(setStartingSectionKey(key));
  }

  useDialogQuitHotkey(open, handleClose);

  // render

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={handleClose}
      disableEnforceFocus
      PaperProps={{
        sx: { bgcolor: PAGE_BG, position: "relative", overflow: "hidden" },
      }}
    >
      <BackgroundDashboard />
      <HeaderStarting
        title={startLabelS}
        sectionKey={sectionKey}
        onSelectSection={handleSelectSection}
        onClose={handleClose}
      />
      <PanelStarting sectionKey={sectionKey} />
    </Dialog>
  );
}
