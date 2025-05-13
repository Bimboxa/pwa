import React from "react";

import {useSelector, useDispatch} from "react-redux";

import {setToaster} from "Features/layout/layoutSlice";

import useInit from "Features/init/hooks/useInit";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

import {Box} from "@mui/material";

import LayoutDesktop from "Features/layout/components/LayoutDesktop";
import LayoutMobile from "Features/layout/components/LayoutMobile";
import {DndContext} from "@dnd-kit/core";

import useDndSensors from "App/hooks/useDndSensors";

import DialogAutoRemoteContainerConnexion from "Features/sync/components/DialogAutoRemoteContainerConnexion";
import PageLanding from "Features/init/components/PageLanding";
import DialogAutoSelectScope from "Features/scopeSelector/components/DialogAutoSelectScope";
import Toaster from "Features/layout/components/Toaster";

export default function MainAppLayout() {
  const dispatch = useDispatch();
  // init

  useInit();

  // data

  const deviceType = useSelector((s) => s.layout.deviceType);
  const sensors = useDndSensors();

  const openLandingPage = useSelector((s) => s.init.openLandingPage);
  const warningWasShowed = useSelector((s) => s.init.warningWasShowed);
  const remoteContainer = useRemoteContainer();

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
      {!openLandingPage && (warningWasShowed || !remoteContainer) && (
        <DialogAutoSelectScope />
      )}
      {!openLandingPage && <DialogAutoRemoteContainerConnexion />}
    </DndContext>
  );
}
