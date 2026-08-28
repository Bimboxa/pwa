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

import {
  Badge,
  Button,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import usePullLastRemoteScopeConfiguration from "../hooks/usePullLastRemoteScopeConfiguration";
import useSaveScopeVersion from "../hooks/useSaveScopeVersion";

import stringifyFileSize from "Features/files/utils/stringifyFileSize";

export default function ButtonSaveScope() {
  const dispatch = useDispatch();

  // strings

  const hotkeyS = navigator.userAgent.includes("Mac") ? "⌘ S" : "Ctrl + S";
  const saveS = "Sauvegarder une nouvelle version";
  const savingS = "Sauvegarde en cours…";
  const moreS = "Options de sauvegarde";

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const lastRemoteConfiguration = useSelector(
    (s) => s.remoteScopeConfigurations.lastRemoteConfiguration
  );
  const lastSyncedRemoteConfigurationVersion = useSelector(
    (s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion
  );
  const isLocallyDirty = useSelector(selectIsLocallyDirty);
  const pushing = useSelector((s) => s.remoteScopeConfigurations.pushing);
  const saving = useSelector((s) => s.remoteScopeConfigurations.saving);
  const savingFileSize = useSelector(
    (s) => s.remoteScopeConfigurations.savingFileSize
  );

  // effects

  useEffect(() => {
    if (scopeId) {
      dispatch(restoreSyncedVersionFromStorage(scopeId));
      dispatch(restoreScopeSyncStateFromStorage(scopeId));
    }
  }, [scopeId, dispatch]);

  const pullLastConfig = usePullLastRemoteScopeConfiguration();
  const saveScopeVersion = useSaveScopeVersion();

  // helpers

  const isSaving = saving || pushing;

  const isPullRequired =
    lastRemoteConfiguration &&
    lastRemoteConfiguration.version >
      (lastSyncedRemoteConfigurationVersion ?? 0);

  const isDirtyLook = isLocallyDirty; // contained warning vs outlined primary

  let tooltipS = "Tout est synchronisé";
  if (isPullRequired)
    tooltipS = "Une version plus récente existe sur le serveur";
  else if (isLocallyDirty)
    tooltipS = "Vous avez des modifications locales non sauvegardées";

  let labelS = saveS;
  if (isSaving) {
    labelS = savingFileSize
      ? `${savingS} (${stringifyFileSize(savingFileSize)})`
      : savingS;
  }

  // handlers

  async function handleSave() {
    await saveScopeVersion();
  }

  async function handleOpenDialog() {
    try {
      await pullLastConfig();
    } catch (error) {
      console.error("[ButtonSaveScope] pull error", error);
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
      <Badge color="error" variant="dot" invisible={!isPullRequired}>
        {/* frame containing the frameless save button + the more button */}
        <Box
          sx={{
            display: "flex",
            alignItems: "stretch",
            borderRadius: 1,
            overflow: "hidden",
            border: (t) =>
              `1px solid ${
                isDirtyLook ? t.palette.warning.main : t.palette.primary.main
              }`,
            bgcolor: isDirtyLook ? "warning.main" : "transparent",
            color: isDirtyLook ? "warning.contrastText" : "primary.main",
          }}
        >
          <Tooltip title={tooltipS}>
            <span style={{ display: "flex" }}>
              <Button
                onClick={handleSave}
                size="small"
                color="inherit"
                disabled={isSaving}
                sx={{ borderRadius: 0 }}
                startIcon={
                  isSaving ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : undefined
                }
              >
                {labelS}
                {!isSaving && (
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
                    }}
                  >
                    {hotkeyS}
                  </Typography>
                )}
              </Button>
            </span>
          </Tooltip>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: "currentColor", opacity: 0.3 }}
          />
          <Tooltip title={moreS}>
            <span style={{ display: "flex" }}>
              <IconButton
                onClick={handleOpenDialog}
                size="small"
                color="inherit"
                disabled={isSaving}
                sx={{ borderRadius: 0, px: 0.25 }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Badge>
    </Box>
  );
}
