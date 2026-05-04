import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setRemoteNewerDialogOpen } from "../remoteScopeConfigurationsSlice";

import useFetchScopeConfiguration from "../hooks/useFetchScopeConfiguration";

import { Box, DialogTitle, Typography } from "@mui/material";
import { Download, CloudUpload } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

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

  // state

  const [downloading, setDownloading] = useState(false);

  // helpers

  const trigram = lastRemoteConfiguration?.createdBy?.trigram;
  const createdAt = lastRemoteConfiguration?.createdAt
    ? new Date(lastRemoteConfiguration.createdAt)
    : null;
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

  // handlers

  function handleClose() {
    dispatch(setRemoteNewerDialogOpen(false));
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await fetchConfiguration();
      dispatch(setRemoteNewerDialogOpen(false));
    } catch (error) {
      console.error("[DialogRemoteNewer] download error", error);
    } finally {
      setDownloading(false);
    }
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
        Vous pouvez télécharger la nouvelle version (vos modifications locales
        seront écrasées) ou générer un zip de votre version actuelle pour la
        conserver avant de poursuivre.
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
          startIcon={<CloudUpload />}
          onClick={handleGenerateZip}
          label="Générer le zip de la version actuelle"
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
