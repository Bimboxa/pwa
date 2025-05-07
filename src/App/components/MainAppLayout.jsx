import React from "react";

import {useSelector, useDispatch} from "react-redux";

import useInit from "Features/init/hooks/useInit";

import {Box} from "@mui/material";

import LayoutDesktop from "Features/layout/components/LayoutDesktop";
import LayoutMobile from "Features/layout/components/LayoutMobile";
import {DndContext} from "@dnd-kit/core";

import useDndSensors from "App/hooks/useDndSensors";
import PageLanding from "Features/init/components/PageLanding";
import DialogAutoSelectScope from "Features/scopeSelector/components/DialogAutoSelectScope";
import Toaster from "Features/layout/components/Toaster";

// sw
import {setupSWUpdateListener} from "App/services/sw-update-listener";
import {setNewVersionAvailable} from "Features/appConfig/appConfigSlice";

export default function MainAppLayout() {
  const dispatch = useDispatch();
  // init

  useInit();

  // data

  const deviceType = useSelector((s) => s.layout.deviceType);
  const sensors = useDndSensors();

  const openLandingPage = useSelector((s) => s.init.openLandingPage);

  // sw

  setupSWUpdateListener(() => {
    dispatch(setToaster({message: "Nouvelle version disponible"}));
    dispatch(setNewVersionAvailable(true));
  });

  return (
    <DndContext sensors={sensors}>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
        }}
      >
        {deviceType === "DESKTOP" && <LayoutDesktop />}
        {deviceType === "MOBILE" && <LayoutMobile />}
      </Box>
      <Toaster />
      <PageLanding />
      {!openLandingPage && <DialogAutoSelectScope />}
    </DndContext>
  );
}
