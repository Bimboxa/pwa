import { useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import store from "App/store";

import {
  restoreSyncedVersionFromStorage,
  restoreScopeSyncStateFromStorage,
  setRemoteNewerDialogOpen,
  setDialogSyncOpen,
  selectIsLocallyDirty,
} from "../remoteScopeConfigurationsSlice";

import { Badge, Button, Box, Tooltip } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import usePullLastRemoteScopeConfiguration from "../hooks/usePullLastRemoteScopeConfiguration";

export default function IconButtonDialogSync() {
  const dispatch = useDispatch();

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const lastRemoteConfiguration = useSelector(
    (s) => s.remoteScopeConfigurations.lastRemoteConfiguration
  );
  const lastSyncedRemoteConfigurationVersion = useSelector(
    (s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion
  );
  const isLocallyDirty = useSelector(selectIsLocallyDirty);

  // effects

  useEffect(() => {
    if (scopeId) {
      dispatch(restoreSyncedVersionFromStorage(scopeId));
      dispatch(restoreScopeSyncStateFromStorage(scopeId));
    }
  }, [scopeId, dispatch]);

  const pullLastConfig = usePullLastRemoteScopeConfiguration();

  // helpers

  const isPullRequired =
    lastRemoteConfiguration &&
    lastRemoteConfiguration.version >
      (lastSyncedRemoteConfigurationVersion ?? 0);

  const variant = isLocallyDirty ? "contained" : "outlined";
  const color = isLocallyDirty ? "warning" : "primary";

  let tooltipS = "Tout est synchronisé";
  if (isPullRequired)
    tooltipS = "Une version plus récente existe sur le serveur";
  else if (isLocallyDirty)
    tooltipS = "Vous avez des modifications locales non sauvegardées";

  // handlers

  async function handleOpen() {
    try {
      await pullLastConfig();
    } catch (error) {
      console.error("[IconButtonDialogSync] pull error", error);
    }
    const state = store.getState().remoteScopeConfigurations;
    const remoteV = state.lastRemoteConfiguration?.version;
    const syncedV = state.lastSyncedRemoteConfigurationVersion;
    if (remoteV != null && syncedV != null && remoteV > syncedV) {
      dispatch(setRemoteNewerDialogOpen(true));
    } else {
      dispatch(setDialogSyncOpen(true));
    }
  }

  return (
    <Box>
      <Tooltip title={tooltipS}>
        <Badge color="error" variant="dot" invisible={!isPullRequired}>
          <Button
            onClick={handleOpen}
            size="small"
            variant={variant}
            color={color}
            startIcon={<CloudUploadIcon />}
          >
            Sauvegarder
          </Button>
        </Badge>
      </Tooltip>
    </Box>
  );
}
