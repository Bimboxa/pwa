import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import {
  setLastSyncedRemoteConfigurationVersion,
  setLastSyncAt,
  selectIsLocallyDirty,
} from "../remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import formatDateTime from "Features/date/utils/formatDateTime";

import useAllScopeConfigurations from "../hooks/useAllScopeConfigurations";
import restoreScopeConfigurationService from "../services/restoreScopeConfigurationService";

import {
  IconButton,
  Tooltip,
  Popover,
  Box,
  Chip,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  History as HistoryIcon,
  CloudDownload as CloudDownloadIcon,
  Computer as ComputerIcon,
} from "@mui/icons-material";

import DialogConfirmRestore from "./DialogConfirmRestore";

// Version history of the selected scope, fetched from the cloud on every
// open. The version synced on this device (lastSyncedRemoteConfigurationVersion,
// persisted per scope in localStorage) is flagged "Sur ce poste"; every other
// version gets a cloud-download button that replaces the local data with that
// version (confirmed in DialogConfirmRestore).

export default function ButtonHistoryScope() {
  // data

  const dispatch = useDispatch();

  const appConfig = useAppConfig();
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const jwt = useSelector((s) => s.auth.jwt);
  const lastSyncedVersion = useSelector(
    (s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion
  );
  const isLocallyDirty = useSelector(selectIsLocallyDirty);

  const getAllVersions = useAllScopeConfigurations();

  // strings

  const noBackupS =
    appConfig?.strings?.scope?.noBackup ??
    "Aucune sauvegarde pour ce plan de repérage.";
  const localS = "Sur ce poste";
  const localDirtyS = "Sur ce poste · modifiée";
  const downloadS = "Télécharger depuis le cloud";
  const redownloadS = "Re-télécharger (écrase les modifications locales)";

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [versionToRestore, setVersionToRestore] = useState(null);

  // helpers

  const open = Boolean(anchorEl);

  function isLocalVersion(v) {
    return (
      v?.version != null &&
      lastSyncedVersion != null &&
      Number(v.version) === Number(lastSyncedVersion)
    );
  }

  // handlers

  async function handleOpen(e) {
    setAnchorEl(e.currentTarget);
    setError(null);
    setLoading(true);
    try {
      const items = await getAllVersions({ scopeId });
      // newest first
      const sorted = [...items].sort(
        (a, b) => (b.version ?? 0) - (a.version ?? 0)
      );
      setVersions(sorted);
    } catch (err) {
      console.error("[ButtonHistoryScope] fetch error", err);
      setError(err.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleClickRestore(version) {
    setVersionToRestore(version);
  }

  function handleCancelRestore() {
    setVersionToRestore(null);
  }

  async function handleConfirmRestore() {
    try {
      await restoreScopeConfigurationService({
        scopeId,
        version: versionToRestore,
        appConfig,
        jwt,
      });
      // Single, controlled refresh after the batched import (the import itself
      // intentionally does not dispatch per-record).
      dispatch(triggerAnnotationsUpdate());
      // The local data now equals the downloaded server version: it becomes
      // the version synced on this device, with no pending local change.
      if (versionToRestore?.version != null) {
        dispatch(
          setLastSyncedRemoteConfigurationVersion(versionToRestore.version)
        );
      }
      dispatch(setLastSyncAt(Date.now()));
      setVersionToRestore(null);
      setAnchorEl(null);
    } catch (err) {
      console.error("[ButtonHistoryScope] restore error", err);
      setError(err.message || "Erreur lors de la restauration");
    }
  }

  if (!scopeId) return null;

  return (
    <>
      <Tooltip title="Historique">
        <IconButton onClick={handleOpen} size="small">
          <HistoryIcon />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: { borderRadius: 2, mt: 0.5, width: 420, maxHeight: 480 },
          },
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="subtitle2">Historique des versions</Typography>
        </Box>
        <Divider />

        {loading && (
          <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              Chargement...
            </Typography>
          </Box>
        )}

        {!loading && error && (
          <Box sx={{ p: 2 }}>
            <Alert
              severity="error"
              sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, display: "block", mb: 0.5 }}
              >
                Impossible de charger l'historique
              </Typography>
              <Typography
                variant="caption"
                component="div"
                sx={{ fontFamily: "monospace", fontSize: 11 }}
              >
                {error}
              </Typography>
            </Alert>
          </Box>
        )}

        {!loading && !error && versions.length === 0 && (
          <Box sx={{ p: 2 }}>
            <Alert severity="info">{noBackupS}</Alert>
          </Box>
        )}

        {!loading && !error && versions.length > 0 && (
          <List dense disablePadding sx={{ overflow: "auto" }}>
            {versions.map((v, idx) => {
              const author = v.createdBy?.trigram || "—";
              const date = formatDateTime(v.createdAt);
              const isLocal = isLocalVersion(v);
              const showDownload = !isLocal || isLocallyDirty;
              const downloadTooltipS = isLocal ? redownloadS : downloadS;
              return (
                <Box key={v.id ?? idx}>
                  {idx > 0 && <Divider component="li" />}
                  <ListItem
                    secondaryAction={
                      showDownload ? (
                        <Tooltip title={downloadTooltipS}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleClickRestore(v)}
                          >
                            <CloudDownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null
                    }
                  >
                    <ListItemText
                      primary={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <span>{`Version ${v.version ?? "?"}`}</span>
                          {isLocal && (
                            <Chip
                              size="small"
                              icon={<ComputerIcon />}
                              label={isLocallyDirty ? localDirtyS : localS}
                              color={isLocallyDirty ? "warning" : "primary"}
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={`${author} — ${date}`}
                    />
                  </ListItem>
                </Box>
              );
            })}
          </List>
        )}
      </Popover>

      <DialogConfirmRestore
        open={Boolean(versionToRestore)}
        onClose={handleCancelRestore}
        version={versionToRestore}
        onConfirmAsync={handleConfirmRestore}
      />
    </>
  );
}
