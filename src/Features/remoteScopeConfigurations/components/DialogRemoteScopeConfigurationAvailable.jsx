import { useState } from "react";

import useFetchScopeConfiguration from "../hooks/useFetchScopeConfiguration";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

import { Box, DialogTitle, Typography, Alert } from "@mui/material";
import { Download } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function DialogRemoteVersionAvailable({
  open,
  onClose,
  remoteConfig,
}) {
  // data

  const fetchConfiguration = useFetchScopeConfiguration();

  // state

  const [loading, setLoading] = useState(false);

  // helpers

  const date = remoteConfig?.createdAt
    ? new Date(remoteConfig.createdAt)
    : null;
  const dateS = date?.toLocaleDateString();
  const timeS = date?.toLocaleTimeString();
  const userS = remoteConfig?.createdBy?.trigram;
  const fileSizeS = stringifyFileSize(remoteConfig?.fileSize);

  // handlers

  async function handleFetch() {
    setLoading(true);
    try {
      await fetchConfiguration();
      onClose();
      window.location.reload();
    } catch (error) {
      console.error("[DialogRemoteVersionAvailable] fetch error", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogGeneric open={open} onClose={onClose} width={500}>
      <DialogTitle>Mise à jour disponible</DialogTitle>

      <Box sx={{ px: 3, pb: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Une version plus récente de ce dossier est disponible sur le serveur.
        </Alert>

        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Date : <strong>{dateS} à {timeS}</strong>
        </Typography>
        {userS && (
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Créateur : <strong>{userS}</strong>
          </Typography>
        )}
        {fileSizeS && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Taille : <strong>{fileSizeS}</strong>
          </Typography>
        )}

        <Box sx={{ display: "flex", gap: 1 }}>
          <ButtonGeneric
            variant="outlined"
            onClick={onClose}
            label="Ignorer"
            sx={{ flex: 1 }}
          />
          <ButtonGeneric
            variant="contained"
            color="primary"
            startIcon={<Download />}
            loading={loading}
            onClick={handleFetch}
            label="Télécharger"
            sx={{ flex: 1 }}
          />
        </Box>
      </Box>
    </DialogGeneric>
  );
}
