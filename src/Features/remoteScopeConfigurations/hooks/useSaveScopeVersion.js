import { useDispatch } from "react-redux";

import store from "App/store";

import {
  setRemoteNewerDialogOpen,
  setSaving,
  setSavingFileSize,
} from "../remoteScopeConfigurationsSlice";

import { setToaster } from "Features/layout/layoutSlice";

import usePullLastRemoteScopeConfiguration from "./usePullLastRemoteScopeConfiguration";
import usePushRemoteScopeConfiguration from "./usePushRemoteScopeConfiguration";

import createKrtoZip from "Features/krtoFile/services/createKrtoZip";

export default function useSaveScopeVersion() {
  const dispatch = useDispatch();

  const pullLastConfig = usePullLastRemoteScopeConfiguration();
  const push = usePushRemoteScopeConfiguration();

  // force: skip the remote-newer guard and push over the newer server
  // version (it stays recoverable from the server's version history).
  const saveScopeVersion = async ({ force = false } = {}) => {
    const scopeId = store.getState().scopes.selectedScopeId;
    const { saving, pushing } = store.getState().remoteScopeConfigurations;
    if (!scopeId || saving || pushing) return;

    dispatch(setSaving(true));
    try {
      if (!force) {
        // remote-newer guard: never silently overwrite a newer server version
        try {
          await pullLastConfig();
        } catch (error) {
          console.error("[useSaveScopeVersion] pull error", error);
        }
        const state = store.getState().remoteScopeConfigurations;
        const remoteV = state.lastRemoteConfiguration?.version;
        const syncedV = state.lastSyncedRemoteConfigurationVersion;
        if (remoteV != null && syncedV != null && remoteV > syncedV) {
          dispatch(setRemoteNewerDialogOpen(true));
          return;
        }
      }

      const file = await createKrtoZip(scopeId);
      dispatch(setSavingFileSize(file.size));

      await push(file);

      dispatch(
        setToaster({
          message: "Nouvelle version sauvegardée",
          severity: "success",
        })
      );
    } catch (error) {
      console.error("[useSaveScopeVersion] save error", error);
      const message = error.message || "Erreur inconnue";
      dispatch(
        setToaster({
          message: `Échec de la sauvegarde : ${message}`,
          severity: "error",
        })
      );
    } finally {
      dispatch(setSaving(false));
    }
  };

  return saveScopeVersion;
}
