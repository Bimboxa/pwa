import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setDialogSyncOpen } from "../remoteScopeConfigurationsSlice";

import usePullLastRemoteScopeConfiguration from "../hooks/usePullLastRemoteScopeConfiguration";
import { setPullHandle } from "../services/pullHandle";

import DialogSync from "./DialogSync";
import DialogStaleChanges from "./DialogStaleChanges";
import DialogRemoteNewer from "./DialogRemoteNewer";

export default function SyncDialogsContainer() {
  const dispatch = useDispatch();

  // data

  const dialogSyncOpen = useSelector(
    (s) => s.remoteScopeConfigurations.dialogSyncOpen
  );
  const lastRemoteConfiguration = useSelector(
    (s) => s.remoteScopeConfigurations.lastRemoteConfiguration
  );
  const lastSyncedRemoteConfigurationVersion = useSelector(
    (s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion
  );

  const pull = usePullLastRemoteScopeConfiguration();

  // effects

  useEffect(() => {
    setPullHandle(pull);
    return () => setPullHandle(null);
  }, [pull]);

  // helpers

  const isPullRequired =
    lastRemoteConfiguration &&
    lastRemoteConfiguration.version >
      (lastSyncedRemoteConfigurationVersion ?? 0);

  // handlers

  function handleCloseDialogSync() {
    dispatch(setDialogSyncOpen(false));
  }

  function handleOpenDialogSync() {
    dispatch(setDialogSyncOpen(true));
  }

  return (
    <>
      <DialogSync
        open={dialogSyncOpen}
        onClose={handleCloseDialogSync}
        isPullRequired={isPullRequired}
      />
      <DialogStaleChanges onConfirmSave={handleOpenDialogSync} />
      <DialogRemoteNewer onRequestSave={handleOpenDialogSync} />
    </>
  );
}
