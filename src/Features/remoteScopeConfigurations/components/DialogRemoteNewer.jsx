import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setRemoteNewerDialogOpen } from "../remoteScopeConfigurationsSlice";

import useFetchScopeConfiguration from "../hooks/useFetchScopeConfiguration";
import useSaveScopeVersion from "../hooks/useSaveScopeVersion";

import { Box, DialogTitle, Typography } from "@mui/material";
import { Download, CloudUpload, Save } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import parseBackendDate from "Features/date/utils/parseBackendDate";

export default function DialogRemoteNewer({ onRequestSave }) {
  const dispatch = useDispatch();

  // data

  const open = useSelector(
    (s) => s.remoteScopeConfigurations.remoteNewerDialogOpen
  );
  const lastRemoteConfiguration = useSelector(
    (s) => s.remoteScopeConfigurations.lastRemoteConfiguration
  );

  const fetchConfiguration = useFetchScopeConfiguration();
  const saveScopeVersion = useSaveScopeVersion();

  // state

  const [downloading, setDownloading] = useState(false);

  // helpers

  const trigram = lastRemoteConfiguration?.createdBy?.trigram;
  const createdAt = parseBackendDate(lastRemoteConfiguration?.createdAt);
  const dateS = createdAt
    ? `${createdAt.toLocaleDateString()} – ${createdAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : null;

  let messageS = "Une version plus récente a été publiée sur le serveur.";
  if (trigram && dateS) {
    messageS = `Une version plus récente a été publiée par ${trigram} le ${dateS}.`;
  } else if (dateS) {
    messageS = `Une version plus récente a été publiée le ${dateS}.`;
  } else if (trigram) {
    messageS = `Une version plus récente a été publiée par ${trigram}.`;
  }

  const detailS = `Vous pouvez enregistrer votre version sur le serveur (la version précédente restera disponible dans l'historique), ou télécharger la nouvelle version pour la fusionner avec vos données locales (vos modifications sont conservées ; en cas de conflit sur un même élément, la modification la plus récente l'emporte). Vous pouvez aussi générer un zip de votre version actuelle pour la conserver.`;

  // handlers

  function handleClose() {
    dispatch(setRemoteNewerDialogOpen(false));
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      // fetchConfiguration merges the remote version into the local data and
      // reloads the page on success.
      await fetchConfiguration();
      dispatch(setRemoteNewerDialogOpen(false));
    } catch (error) {
      console.error("[DialogRemoteNewer] download error", error);
    } finally {
      setDownloading(false);
    }
  }

  async function handleForceSave() {
    dispatch(setRemoteNewerDialogOpen(false));
    await saveScopeVersion({ force: true });
  }

  function handleGenerateZip() {
    dispatch(setRemoteNewerDialogOpen(false));
    if (onRequestSave) onRequestSave();
  }

  return (
    <DialogGeneric open={open} onClose={handleClose} width={520}>
      <DialogTitle>Conflit de version</DialogTitle>

      <Typography
        variant="body2"
        sx={{ px: 3, pb: 1, color: "text.secondary" }}
      >
        {messageS}
      </Typography>
      <Typography
        variant="body2"
        sx={{ px: 3, pb: 2, color: "text.secondary" }}
      >
        {detailS}
      </Typography>

      <Box
        sx={{
          px: 3,
          pb: 3,
          display: "flex",
          gap: 1,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <ButtonGeneric
          variant="outlined"
          startIcon={<Save />}
          onClick={handleGenerateZip}
          label="Générer le zip de la version actuelle"
        />
        <ButtonGeneric
          variant="outlined"
          color="warning"
          startIcon={<CloudUpload />}
          onClick={handleForceSave}
          label="Enregistrer ma version sur le serveur"
        />
        <ButtonGeneric
          variant="contained"
          color="primary"
          startIcon={<Download />}
          loading={downloading}
          onClick={handleDownload}
          label="Télécharger la nouvelle version"
        />
      </Box>
    </DialogGeneric>
  );
}
