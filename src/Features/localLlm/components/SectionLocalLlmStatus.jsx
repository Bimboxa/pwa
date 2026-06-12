import { useDispatch, useSelector } from "react-redux";

import { setModelStatus, setDownloadProgress } from "../localLlmSlice";

import { Box, Typography, LinearProgress } from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import { getSession } from "../services/geminiNanoService";

export default function SectionLocalLlmStatus() {
  const dispatch = useDispatch();

  // strings

  const unsupportedS =
    "L'API Prompt n'est pas disponible dans ce navigateur. Elle nécessite Chrome 138+ avec le flag chrome://flags/#prompt-api-for-gemini-nano activé (ou un token d'Origin Trial en production).";
  const unavailableS =
    "Le modèle Gemini Nano n'est pas disponible sur cet appareil (requis : ~22 Go de disque libre, 16 Go de RAM ou GPU > 4 Go de VRAM).";
  const checkingS = "Vérification de la disponibilité du modèle...";
  const downloadS = "Télécharger le modèle";
  const downloadingS = "Téléchargement de Gemini Nano...";
  const availableS = "Gemini Nano · 100% local";

  // data

  const modelStatus = useSelector((s) => s.localLlm.modelStatus);
  const downloadProgress = useSelector((s) => s.localLlm.downloadProgress);

  // handlers

  async function handleDownload() {
    dispatch(setModelStatus("downloading"));
    try {
      // creating the session triggers the model download
      await getSession({
        onDownloadProgress: (loaded) => dispatch(setDownloadProgress(loaded)),
      });
      dispatch(setModelStatus("available"));
    } catch (err) {
      console.error("[localLlm] model download failed", err);
      dispatch(setModelStatus("unavailable"));
    }
  }

  // render

  if (modelStatus === "available") {
    return (
      <Box sx={{ px: 1, py: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {availableS}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      {modelStatus === "checking" && (
        <Typography variant="body2" color="text.secondary">
          {checkingS}
        </Typography>
      )}

      {(modelStatus === "unsupported" || modelStatus === "unavailable") && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ whiteSpace: "pre-line" }}
        >
          {modelStatus === "unsupported" ? unsupportedS : unavailableS}
        </Typography>
      )}

      {modelStatus === "downloadable" && (
        <ButtonGeneric
          variant="contained"
          color="secondary"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          label={downloadS}
        />
      )}

      {modelStatus === "downloading" && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {downloadingS}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={downloadProgress * 100}
          />
        </Box>
      )}
    </Box>
  );
}
