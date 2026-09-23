import { Box, Typography } from "@mui/material";

const number = (value) =>
  value == null ? "indisponible" : value.toLocaleString("fr-FR");

export default function ChatTokenUsage({ usage, active }) {
  const {
    step,
    inputTokens,
    outputTokens,
    reasoningTokens,
    maxOutputTokens,
    confirmed,
    completedInputTokens,
    completedOutputTokens,
  } = usage;
  return (
    <Box sx={{ mt: 0.75, color: "text.secondary" }}>
      <Typography variant="caption" display="block">
        Appel {step} · Entrée : {number(inputTokens)} tokens
      </Typography>
      <Typography variant="caption" display="block">
        {confirmed ? "Sortie totale" : "Sortie visible estimée"} :{" "}
        {confirmed ? "" : "≈ "}
        {number(outputTokens)} tokens
        {maxOutputTokens != null && ` · Limite : ${number(maxOutputTokens)}`}
      </Typography>
      <Typography variant="caption" display="block">
        {confirmed
          ? `Dont réflexion : ${number(reasoningTokens)} tokens · Comptage OpenAI`
          : `Réflexion ${active ? "en cours ou en attente" : "non comptabilisée"} : compteur disponible en fin d’appel. La limite inclut la réflexion.`}
      </Typography>
      {step > 1 && (
        <Typography variant="caption" display="block">
          Appels précédents : {number(completedInputTokens)} en entrée ·{" "}
          {number(completedOutputTokens)} en sortie
        </Typography>
      )}
    </Box>
  );
}
