import { useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setWindowHeight } from "Features/layout/layoutSlice";

import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";
import useDndSensors from "App/hooks/useDndSensors";
import useAutoRedirect from "App/hooks/useAutoRedirect";
import useAutoSelectListing from "Features/listings/hooks/useAutoSelectListing";

import { Box } from "@mui/material";

import { DndContext } from "@dnd-kit/core";

import LayoutDesktop from "Features/layout/components/LayoutDesktop";
import LayoutMobile from "Features/layout/components/LayoutMobile";

import DialogAutoRemoteContainerConnexion from "Features/sync/components/DialogAutoRemoteContainerConnexion";
import PageLanding from "Features/init/components/PageLanding";
import DialogAutoSelectScope from "Features/scopeSelector/components/DialogAutoSelectScope";
import Toaster from "Features/layout/components/Toaster";
import useAutoFetchOrgaDataFolder from "Features/orgaData/hooks/useAutoFetchOrgaDataFolder";
import DialogAutoListingsConfig from "Features/listingsConfig/components/DialogAutoListingsConfig";
import DialogAutoSyncTasks from "Features/sync/components/DialogAutoSyncTasks";
import DialogAutoDownloadListingsData from "Features/listingsConfig/components/DialogAutoDownloadListingsData";
import DialogAutoAddListing from "Features/listings/components/DialogAutoAddListing";
import DialogAutoScopeCreator from "Features/scopeCreator/components/DialogAutoScopeCreator";

export default function MainAppLayout() {
  const dispatch = useDispatch();

  // auto

  useAutoFetchOrgaDataFolder();
  useAutoRedirect();
  useAutoSelectListing();

  // data

  const deviceType = useSelector((s) => s.layout.deviceType);
  const sensors = useDndSensors();

  const openLandingPage = useSelector((s) => s.init.openLandingPage);
  const warningWasShowed = useSelector((s) => s.init.warningWasShowed);
  const remoteContainer = useRemoteContainer();

  // effect

  useEffect(() => {
    function handleResize() {
      dispatch(setWindowHeight(window.innerHeight));
    }

    // Set initial height
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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
      {/*<DialogAutoListingsConfig />*/}
      <DialogAutoDownloadListingsData />
      <DialogAutoSyncTasks />
      <DialogAutoAddListing />
      <DialogAutoScopeCreator />
    </DndContext>
  );
}
