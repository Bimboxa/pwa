import { useCallback, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import store from "App/store";

import {
  setDialogSyncOpen,
  setConfirmSaveDialogOpen,
} from "../remoteScopeConfigurationsSlice";

import usePullLastRemoteScopeConfiguration from "../hooks/usePullLastRemoteScopeConfiguration";
import useAutoTriggerInitialScopeSaveOnCreate from "../hooks/useAutoTriggerInitialScopeSaveOnCreate";
import { setPullHandle } from "../services/pullHandle";

import useSaveShortcut from "Features/layout/hooks/useSaveShortcut";

import DialogSync from "./DialogSync";
import DialogStaleChanges from "./DialogStaleChanges";
import DialogRemoteNewer from "./DialogRemoteNewer";
import DialogConfirmSaveVersion from "./DialogConfirmSaveVersion";

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

  useAutoTriggerInitialScopeSaveOnCreate();

  // effects

  useEffect(() => {
    setPullHandle(pull);
    return () => setPullHandle(null);
  }, [pull]);

  const handleSaveShortcut = useCallback(() => {
    const state = store.getState();
    const scopeId = state.scopes.selectedScopeId;
    const {
      saving,
      pushing,
      dialogSyncOpen: syncOpen,
      remoteNewerDialogOpen,
      confirmSaveDialogOpen,
    } = state.remoteScopeConfigurations;
    if (!scopeId || saving || pushing) return;
    if (syncOpen || remoteNewerDialogOpen || confirmSaveDialogOpen) return;
    dispatch(setConfirmSaveDialogOpen(true));
  }, [dispatch]);

  useSaveShortcut(handleSaveShortcut);

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
      <DialogConfirmSaveVersion />
    </>
  );
}
