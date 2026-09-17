import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setReasoningLevelId, setReasoningLevels } from "../chatSlice";

import { Box, Button, TextField, Typography } from "@mui/material";

import { LEVEL_STORAGE_KEY } from "./ChatLevelSelect";

import useAssistantRelayToken from "Features/assistantRelay/hooks/useAssistantRelayToken";
import {
  describeRelayError,
  fetchReasoningLevels,
} from "Features/assistantRelay/services/assistantRelayClient";

// Under the header: pairing key of the relay (until OAuth exists). Shown only
// when there is something to do — no key yet, an error, or the status dot of
// the header was clicked (`editing`). Always mounted: it also loads the
// levels of reflection offered by ChatLevelSelect. The connection itself is
// kept by AssistantRelayRuntime: this bar only edits the token.
export default function ChatRelayBar({ editing, onEditingChange }) {
  const dispatch = useDispatch();

  // strings

  const keyLabelS = "Clé du serveur IA";
  const connectS = "Connecter";
  const forgetS = "Oublier la clé";
  const hintS = "La clé est conservée dans cet onglet seulement.";

  // data

  const { token, setToken } = useAssistantRelayToken();
  const connectionStatus = useSelector(
    (s) => s.assistantRelay.connectionStatus
  );
  const connectionError = useSelector((s) => s.assistantRelay.connectionError);
  const connected = connectionStatus === "connected";

  // state

  const [draft, setDraft] = useState("");
  const [modelsError, setModelsError] = useState(null);

  // Three levels of reflection; the relay decides which model each one
  // means, from what the provider's account offers.
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchReasoningLevels();
        if (cancelled) return;
        dispatch(setReasoningLevels(list));
        setModelsError(null);
        let saved = null;
        try {
          saved = localStorage.getItem(LEVEL_STORAGE_KEY);
        } catch {
          // ignore
        }
        const initial =
          list.find((m) => m.id === saved) ??
          list.find((m) => m.isDefault) ??
          list[0];
        dispatch(setReasoningLevelId(initial?.id ?? null));
      } catch (e) {
        if (cancelled) return;
        dispatch(setReasoningLevels([]));
        setModelsError(e?.code ? describeRelayError(e) : e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, dispatch]);

  // handlers

  function handleConnect() {
    if (!draft.trim()) return;
    setToken(draft);
    setDraft("");
    onEditingChange?.(false);
  }

  function handleForget() {
    setToken("");
    onEditingChange?.(false);
  }

  // render

  const showKeyForm = !token || editing || connectionStatus === "error";
  const showModelsError = connected && Boolean(modelsError);
  if (!showKeyForm && !showModelsError) return null;

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        borderBottom: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.default",
      }}
    >
      {showKeyForm ? (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            fullWidth
            type="password"
            label={keyLabelS}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConnect();
            }}
            autoComplete="off"
          />
          <Button
            size="small"
            variant="contained"
            color="secondary"
            disabled={!draft.trim()}
            onClick={handleConnect}
            sx={{ flexShrink: 0, height: 32 }}
          >
            {connectS}
          </Button>
        </Box>
      ) : null}
      {showKeyForm && token ? (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="small" color="inherit" onClick={handleForget}>
            {forgetS}
          </Button>
        </Box>
      ) : null}

      {connectionStatus === "error" && connectionError ? (
        <Typography variant="caption" color="error">
          {connectionError}
        </Typography>
      ) : null}
      {connected && modelsError ? (
        <Typography variant="caption" color="error">
          {modelsError}
        </Typography>
      ) : null}
      {!token ? (
        <Typography variant="caption" color="text.secondary">
          {hintS}
        </Typography>
      ) : null}
    </Box>
  );
}
