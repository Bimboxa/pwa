import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { serializeDetectionDebug } from "../utils/groupDetectionDebug";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

export default function ChatDetectionDebug({ record, active = false }) {
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const serialize = () => serializeDetectionDebug(record);
  function download() {
    const url = URL.createObjectURL(
      new Blob([serialize()], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `diagnostic-${record.messageId ?? record.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(serialize());
      setCopyStatus("Copié");
    } catch {
      setCopyStatus("Copie impossible. Ouvrez le JSON pour le sélectionner.");
      setExpanded(true);
    }
  }
  if (active)
    return (
      <Typography
        role="status"
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 0.75 }}
      >
        Diagnostic en cours...
      </Typography>
    );
  return (
    <Box
      sx={{ mt: 0.75, borderLeft: "2px solid", borderColor: "divider", pl: 1 }}
    >
      <Stack spacing={0.5}>
        <Typography variant="caption" sx={{ flex: 1 }}>
          Données du diagnostic
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Les captures techniques enregistrées pendant le traitement sont
          regroupées au format JSON. Copiez-les pour les partager, téléchargez
          un fichier pour les conserver ou affichez le JSON pour les consulter
          ici.
        </Typography>
        <Button
          size="small"
          startIcon={<ContentCopyIcon fontSize="inherit" />}
          onClick={copy}
        >
          Copier les données
        </Button>
        <Button size="small" onClick={download}>
          Télécharger le fichier JSON
        </Button>
        <Button
          size="small"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Masquer le JSON" : "Afficher le JSON"}
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {new Date(record.createdAt).toLocaleString()}
      </Typography>
      {copyStatus && (
        <Typography role="status" variant="caption" sx={{ display: "block" }}>
          {copyStatus}
        </Typography>
      )}
      {record.saveError && (
        <Typography variant="caption" color="error">
          Archivage local impossible : {record.saveError}
        </Typography>
      )}
      {expanded && (
        <Box
          component="pre"
          sx={{
            maxHeight: 240,
            overflow: "auto",
            fontSize: 11,
            whiteSpace: "pre",
            userSelect: "text",
          }}
        >
          {serialize()}
        </Box>
      )}
    </Box>
  );
}
