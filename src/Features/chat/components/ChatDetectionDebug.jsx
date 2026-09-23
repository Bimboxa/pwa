import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

const LABELS = {
  raw_detection: "Détection brute du LLM",
  converted_detection: "Géométrie convertie par le serveur",
  pdf_inspection: "Diagnostic de lecture du PDF",
};

export default function ChatDetectionDebug({ record }) {
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const artifact = record.artifact;
  // Keep the exact raw argument string in the export, even if invalid JSON.
  const serialize = () =>
    JSON.stringify(
      {
        version: 1,
        createdAt: record.createdAt,
        messageId: record.messageId,
        listingId: record.listingId,
        ...artifact,
      },
      null,
      2
    );
  async function copy() {
    try {
      await navigator.clipboard.writeText(serialize());
      setCopyStatus("Copié");
    } catch {
      setCopyStatus("Copie impossible. Ouvrez le JSON pour le sélectionner.");
      setExpanded(true);
    }
  }
  return (
    <Box
      sx={{ mt: 0.75, borderLeft: "2px solid", borderColor: "divider", pl: 1 }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="caption" sx={{ flex: 1 }}>
          {LABELS[artifact.stage] ?? "Diagnostic"}
        </Typography>
        <Button
          size="small"
          startIcon={<ContentCopyIcon fontSize="inherit" />}
          onClick={copy}
        >
          Copier
        </Button>
        <Button
          size="small"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          JSON
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
      {artifact.stage === "pdf_inspection" && (
        <Typography variant="caption" sx={{ display: "block" }}>
          Diagnostic technique ; ce n’est pas une géométrie détectée.
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
