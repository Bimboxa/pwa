import { useState, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import usePushRemoteScopeConfiguration from "../hooks/usePushRemoteScopeConfiguration";

import {
  Box,
  DialogTitle,
  Typography,
  LinearProgress,
  Alert,
} from "@mui/material";
import { Download, CloudUpload } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionPullRemoteScopeConfiguration from "./SectionPullRemoteScopeConfiguration";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import createKrtoZip from "Features/krtoFile/services/createKrtoZip";
import downloadBlob from "Features/files/utils/downloadBlob";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

export default function DialogSync({ open, onClose, isPullRequired }) {
  const dispatch = useDispatch();

  // data

  const push = usePushRemoteScopeConfiguration();
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // state

  const [zipFile, setZipFile] = useState(null);
  const [zipError, setZipError] = useState(null);
  const [zipping, setZipping] = useState(false);
  const [pushing, setPushing] = useState(false);

  // helpers

  const titleS = `Sauvegarde`;

  // effects

  useEffect(() => {
    if (!open) {
      setZipFile(null);
      setZipError(null);
      setZipping(false);
      setPushing(false);
      return;
    }
    generateZip();
  }, [open]);

  // handlers

  async function generateZip() {
    setZipping(true);
    setZipFile(null);
    setZipError(null);
    try {
      const file = await createKrtoZip(scopeId);
      setZipFile(file);
    } catch (error) {
      console.error("[DialogSync] zip generation error", error);
      const message = error.message || "Erreur lors de la génération du fichier";
      setZipError(message);
      dispatch(
        setToaster({
          message: `Échec de la sauvegarde : ${message}`,
          severity: "error",
        })
      );
    } finally {
      setZipping(false);
    }
  }

  function handleClose() {
    onClose();
  }

  function handleDownload() {
    if (zipFile) {
      downloadBlob(zipFile, zipFile.name);
    }
  }

  async function handlePush() {
    setPushing(true);
    try {
      await push(zipFile);
      onClose();
    } catch (error) {
      console.error("[DialogSync] push error", error);
    } finally {
      setPushing(false);
    }
  }

  return (
    <DialogGeneric open={open} onClose={handleClose} width={500}>
      <DialogTitle>{titleS}</DialogTitle>

      <Typography variant="body2" sx={{ px: 3, pb: 2, color: "text.secondary" }}>
        Les données de votre projet sont enregistrées dans le cache du
        navigateur. Pour les partager ou les récupérer sur un autre poste,
        effectuez une sauvegarde serveur en cliquant sur le bouton ci-dessous.
      </Typography>

      {isPullRequired && <SectionPullRemoteScopeConfiguration />}

      <Box sx={{ px: 3, pb: 2 }}>
        {/* Step 2: ZIP generation */}
        {zipping && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Génération du fichier en cours...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {/* ZIP error */}
        {zipError && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {zipError}
          </Alert>
        )}

        {/* Step 2 done: show file info + actions */}
        {zipFile && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="body2">
              Fichier généré : <strong>{stringifyFileSize(zipFile.size)}</strong>
            </Typography>

            <Box sx={{ display: "flex", gap: 1 }}>
              <ButtonGeneric
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownload}
                label="Télécharger"
                sx={{ flex: 1 }}
              />

              {/* Step 3: push to server */}
              <ButtonGeneric
                variant="contained"
                color="primary"
                startIcon={<CloudUpload />}
                loading={pushing}
                onClick={handlePush}
                label="Envoyer sur le serveur"
                sx={{ flex: 1 }}
              />
            </Box>
          </Box>
        )}
      </Box>
    </DialogGeneric>
  );
}
