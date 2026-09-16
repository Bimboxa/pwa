import { useEffect, useState } from "react";

import { Box, Button, Chip, TextField, Typography } from "@mui/material";

import useAssistantRelayToken from "../hooks/useAssistantRelayToken";

const STATUS_CHIP = {
  idle: { label: "Non connecté", color: "default" },
  checking: { label: "Vérification…", color: "default" },
  connected: { label: "Connecté", color: "success" },
  error: { label: "Erreur", color: "error" },
};

export default function SectionAssistantRelayConnection({
  connectionStatus,
  connectionError,
  relayBaseUrl,
  onRefresh,
}) {
  // strings

  const tokenLabelS = "Token d'appairage (PWA)";
  const applyS = "Connecter";
  const forgetS = "Oublier";
  const refreshS = "Rafraîchir";
  const hintS =
    "Le token est conservé dans cet onglet seulement. Il est fourni avec le relai (PWA_TOKEN).";

  // data

  const { token, setToken } = useAssistantRelayToken();

  // state

  const [draft, setDraft] = useState(token ?? "");

  useEffect(() => {
    setDraft(token ?? "");
  }, [token]);

  // helpers

  const chip = STATUS_CHIP[connectionStatus] ?? STATUS_CHIP.idle;
  const canApply = draft.trim().length > 0 && draft.trim() !== token;

  // handlers

  function handleApply() {
    setToken(draft);
  }

  function handleForget() {
    setToken("");
  }

  // render

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary" noWrap>
          {relayBaseUrl}
        </Typography>
        <Chip size="small" label={chip.label} color={chip.color} />
      </Box>

      <TextField
        size="small"
        fullWidth
        type="password"
        label={tokenLabelS}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canApply) handleApply();
        }}
        autoComplete="off"
      />

      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        {token && (
          <Button size="small" onClick={handleForget}>
            {forgetS}
          </Button>
        )}
        {token && connectionStatus !== "checking" && (
          <Button size="small" onClick={onRefresh}>
            {refreshS}
          </Button>
        )}
        <Button
          size="small"
          variant="contained"
          disabled={!canApply}
          onClick={handleApply}
        >
          {applyS}
        </Button>
      </Box>

      {connectionStatus === "error" && connectionError && (
        <Typography variant="caption" color="error">
          {connectionError}
        </Typography>
      )}
      {!token && (
        <Typography variant="caption" color="text.secondary">
          {hintS}
        </Typography>
      )}
    </Box>
  );
}
