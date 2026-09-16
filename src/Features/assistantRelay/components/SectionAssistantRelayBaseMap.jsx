import { useSelector } from "react-redux";

import { Alert, Box, Button, Typography } from "@mui/material";
import { CloudUpload } from "@mui/icons-material";

import usePublishCurrentBaseMap from "../hooks/usePublishCurrentBaseMap";

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

export default function SectionAssistantRelayBaseMap() {
  // strings

  const titleS = "Fond de plan courant";
  const publishS = "Publier le fond de plan courant";
  const noBaseMapS = "Aucun fond de plan affiché dans l'éditeur.";
  const noScaleS =
    "Ce fond n'est pas calibré (échelle inconnue) : les cotes détectées n'auront pas de valeur réelle.";
  const publishedS = "Dernière publication";
  const otherBaseMapS =
    "Le fond publié sur le relai n'est pas celui affiché : republiez avant de lancer une détection.";

  // data

  const { publish, publishStatus, mainBaseMap } = usePublishCurrentBaseMap();
  const currentSnapshot = useSelector((s) => s.assistantRelay.currentSnapshot);

  // helpers

  const publishing = publishStatus?.status === "publishing";
  const refSize = mainBaseMap?.getImageSize?.();
  const meterByPx = mainBaseMap?.getMeterByPx?.();
  const snapshotIsCurrentBaseMap =
    currentSnapshot &&
    mainBaseMap?.id &&
    currentSnapshot.baseMapId === mainBaseMap.id;

  // render

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="subtitle2">{titleS}</Typography>

      {!mainBaseMap?.id && (
        <Typography variant="body2" color="text.secondary">
          {noBaseMapS}
        </Typography>
      )}

      {mainBaseMap?.id && (
        <Typography variant="body2" noWrap>
          {mainBaseMap.name ?? mainBaseMap.id}
          {refSize?.width ? ` — ${refSize.width}×${refSize.height} px` : ""}
        </Typography>
      )}

      {mainBaseMap?.id && !(meterByPx > 0) && (
        <Alert severity="warning" sx={{ py: 0 }}>
          {noScaleS}
        </Alert>
      )}

      <Button
        variant="contained"
        startIcon={<CloudUpload />}
        disabled={!mainBaseMap?.id || publishing}
        loading={publishing}
        onClick={publish}
      >
        {publishS}
      </Button>

      {publishStatus?.status === "error" && publishStatus.message && (
        <Alert severity="error" sx={{ py: 0 }}>
          {publishStatus.message}
        </Alert>
      )}

      {currentSnapshot && (
        <Typography variant="caption" color="text.secondary">
          {publishedS} : {currentSnapshot.name ?? currentSnapshot.baseMapId}
          {" · "}
          {formatDate(currentSnapshot.publishedAt)}
          {currentSnapshot.image?.width
            ? ` · ${currentSnapshot.image.width}×${currentSnapshot.image.height}`
            : ""}
        </Typography>
      )}

      {currentSnapshot && mainBaseMap?.id && !snapshotIsCurrentBaseMap && (
        <Alert severity="info" sx={{ py: 0 }}>
          {otherBaseMapS}
        </Alert>
      )}
    </Box>
  );
}
