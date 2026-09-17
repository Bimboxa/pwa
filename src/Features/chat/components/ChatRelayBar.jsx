import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setReasoningLevelId, setReasoningLevels } from "../chatSlice";

import {
  Box,
  Button,
  Chip,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";

import useAssistantRelayToken from "Features/assistantRelay/hooks/useAssistantRelayToken";
import {
  describeRelayError,
  fetchReasoningLevels,
} from "Features/assistantRelay/services/assistantRelayClient";

const LEVEL_STORAGE_KEY = "bimboxa-chat-reasoningLevel";

const STATUS_CHIP = {
  idle: { label: "Non connecté", color: "default" },
  checking: { label: "Vérification…", color: "default" },
  connected: { label: "Connecté", color: "success" },
  error: { label: "Erreur", color: "error" },
};

// Top of the chat: pairing key of the relay (until OAuth exists) and the
// model used for the next vectorization. The connection itself is kept by
// AssistantRelayRuntime: this bar only edits the token and reads the status.
export default function ChatRelayBar() {
  const dispatch = useDispatch();

  // strings

  const keyLabelS = "Clé du serveur IA";
  const connectS = "Connecter";
  const forgetS = "Oublier la clé";
  const levelS = "Réflexion";
  const hintS = "La clé est conservée dans cet onglet seulement.";

  // data

  const { token, setToken } = useAssistantRelayToken();
  const connectionStatus = useSelector(
    (s) => s.assistantRelay.connectionStatus
  );
  const connectionError = useSelector((s) => s.assistantRelay.connectionError);
  const levels = useSelector((s) => s.chat.reasoningLevels);
  const levelId = useSelector((s) => s.chat.reasoningLevelId);
  const connected = connectionStatus === "connected";

  // state

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
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
    setEditing(false);
  }

  function handleForget() {
    setToken("");
    setEditing(false);
  }

  function handleModelChange(e) {
    const id = e.target.value;
    dispatch(setReasoningLevelId(id));
    try {
      localStorage.setItem(LEVEL_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  // render

  const chip = STATUS_CHIP[connectionStatus] ?? STATUS_CHIP.idle;
  const showKeyForm = !token || editing || connectionStatus === "error";

  return (
    <Box
      sx={{
        p: 1,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderBottom: "1px solid #ddd",
        backgroundColor: "white",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Chip
          size="small"
          label={chip.label}
          color={chip.color}
          onClick={() => setEditing((v) => !v)}
        />
        {connected && levels.length > 0 ? (
          <>
            <Typography variant="caption" color="text.secondary">
              {levelS}
            </Typography>
            <Select
              size="small"
              variant="standard"
              value={levelId ?? ""}
              onChange={handleModelChange}
              sx={{ flex: 1, minWidth: 0, fontSize: 13 }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
            >
              {levels.map((l) => (
                <MenuItem key={l.id} value={l.id} sx={{ fontSize: 13 }}>
                  {l.label}
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    {l.model}
                    {l.reasoningEffort ? ` · ${l.reasoningEffort}` : ""}
                  </Typography>
                </MenuItem>
              ))}
            </Select>
          </>
        ) : null}
      </Box>

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
            disabled={!draft.trim()}
            onClick={handleConnect}
          >
            {connectS}
          </Button>
        </Box>
      ) : null}
      {showKeyForm && token ? (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="small" onClick={handleForget}>
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
