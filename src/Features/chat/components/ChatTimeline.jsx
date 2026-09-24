import { useEffect, useState } from "react";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Box, Button, Stack, Typography } from "@mui/material";
import {
  formatStepDuration,
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
        {(timeline?.entries ?? []).map((entry) => (
          <Box component="li" key={entry.id}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {entry.kind === "model" && (
                <SmartToyOutlinedIcon
                  aria-label="Appel au modèle"
                  sx={{ fontSize: 16, color: "text.secondary" }}
                />
              )}
              <Typography variant="body2">{entry.title}</Typography>
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
            {entry.summary && (
              <Typography variant="body2" color="text.secondary">
                {entry.summary}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
