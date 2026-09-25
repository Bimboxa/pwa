import { useEffect, useState } from "react";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  formatStepDuration,
  formatTokenUsage,
  serializeChatTimeline,
} from "../utils/chatTimeline";

const STATUS = {
  running: "En cours",
  done: "Terminé",
  failed: "Échec",
  interrupted: "Interrompu",
};

export default function ChatTimeline({ timeline, active }) {
  const [copyStatus, setCopyStatus] = useState("");
  const [codeEntryId, setCodeEntryId] = useState(null);
  const codeEntry = timeline?.entries?.find(
    (entry) => entry.id === codeEntryId
  );
  const copySteps = async () => {
    try {
      await navigator.clipboard.writeText(serializeChatTimeline(timeline));
      setCopyStatus("JSON copié");
    } catch {
      setCopyStatus(
        "Copie impossible : vérifiez les permissions du presse-papiers."
      );
    }
  };
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return (
    <Box sx={{ my: 1.5 }}>
      <Typography variant="subtitle2">Étapes du traitement</Typography>
      {!active && timeline?.entries?.length > 0 && (
        <Box sx={{ my: 1 }}>
          <Button
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={copySteps}
          >
            Copier les étapes en JSON
          </Button>
          <Typography variant="caption" display="block" role="status">
            {copyStatus}
          </Typography>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">
        Appels et outils observés. Les phrases résument leur contexte, pas la
        réflexion interne du modèle.
      </Typography>
      {timeline?.omitted > 0 && (
        <Typography variant="caption" display="block">
          {timeline.omitted} étapes anciennes non conservées.
        </Typography>
      )}
      {!timeline?.entries?.length && (
        <Typography variant="body2" color="text.secondary">
          Aucune étape enregistrée pour ce message.
        </Typography>
      )}
      <Stack component="ol" spacing={1} sx={{ pl: 2.5, my: 1 }}>
        {(timeline?.entries ?? []).map((entry, index) => (
          <Box
            component="li"
            key={entry.id}
            value={entry.stepNumber ?? (timeline?.omitted ?? 0) + index + 1}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              {entry.kind === "model" && (
                <SmartToyOutlinedIcon
                  aria-label="Appel au modèle"
                  sx={{ fontSize: 16, color: "text.secondary" }}
                />
              )}
              <Typography variant="body2">{entry.title}</Typography>
              {entry.name === "code_interpreter" &&
                typeof entry.code === "string" && (
                  <Tooltip title="Voir le code Python">
                    <IconButton
                      size="small"
                      aria-label="Voir le code Python"
                      onClick={() => setCodeEntryId(entry.id)}
                    >
                      <CodeIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
            </Stack>
            <Typography
              variant="caption"
              color={entry.status === "failed" ? "error" : "text.secondary"}
            >
              {STATUS[entry.status]} · {formatStepDuration(entry, now)}
              {entry.model ? ` · ${entry.model}` : ""}
            </Typography>
            {entry.kind === "tool" && (
              <Typography
                variant="caption"
                display="block"
                color="text.secondary"
                sx={{ overflowWrap: "anywhere" }}
              >
                {entry.name}
              </Typography>
            )}
            {entry.kind === "model" && formatTokenUsage(entry.usage) && (
              <Typography
                variant="caption"
                display="block"
                color="text.secondary"
              >
                {formatTokenUsage(entry.usage)}
              </Typography>
            )}
            {entry.detail && (
              <Typography
                variant="body2"
                color="error"
                sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {entry.detail}
              </Typography>
            )}
            {entry.summary && (
              <Typography variant="body2" color="text.secondary">
                {entry.summary}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
      {formatTokenUsage(timeline?.usage) && (
        <Typography variant="caption" color="text.secondary">
          Total du tour : {formatTokenUsage(timeline.usage)}
        </Typography>
      )}
      <Dialog
        open={Boolean(codeEntry)}
        onClose={() => setCodeEntryId(null)}
        fullWidth
        maxWidth="md"
        aria-labelledby="python-step-code-title"
      >
        <DialogTitle id="python-step-code-title">
          Code Python
          {codeEntry?.stepNumber ? ` · Étape ${codeEntry.stepNumber}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            component="pre"
            sx={{
              m: 0,
              overflowX: "auto",
              fontFamily: "monospace",
              fontSize: 13,
              whiteSpace: "pre",
              tabSize: 4,
            }}
          >
            <code>{codeEntry?.code}</code>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCodeEntryId(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
