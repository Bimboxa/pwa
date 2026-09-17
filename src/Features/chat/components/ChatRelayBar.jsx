import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setVectorizationModelId, setVectorizationModels } from "../chatSlice";

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
  fetchVectorizationModels,
} from "Features/assistantRelay/services/assistantRelayClient";

const MODEL_STORAGE_KEY = "bimboxa-chat-vectorizationModel";

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
  const modelS = "Modèle";
  const hintS = "La clé est conservée dans cet onglet seulement.";

  // data

  const { token, setToken } = useAssistantRelayToken();
  const connectionStatus = useSelector(
    (s) => s.assistantRelay.connectionStatus
  );
  const connectionError = useSelector((s) => s.assistantRelay.connectionError);
  const models = useSelector((s) => s.chat.vectorizationModels);
  const modelId = useSelector((s) => s.chat.vectorizationModelId);
  const connected = connectionStatus === "connected";

  // state

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [modelsError, setModelsError] = useState(null);

  // The list comes from the relay (which asks the provider): a new model
  // shows up here without a PWA release.
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchVectorizationModels();
        if (cancelled) return;
        dispatch(setVectorizationModels(list));
        setModelsError(null);
        let saved = null;
        try {
          saved = localStorage.getItem(MODEL_STORAGE_KEY);
        } catch {
          // ignore
        }
        const initial =
          list.find((m) => m.id === saved) ??
          list.find((m) => m.isDefault) ??
          list[0];
        dispatch(setVectorizationModelId(initial?.id ?? null));
      } catch (e) {
        if (cancelled) return;
        dispatch(setVectorizationModels([]));
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
    dispatch(setVectorizationModelId(id));
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, id);
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
        {connected && models.length > 0 ? (
          <>
            <Typography variant="caption" color="text.secondary">
              {modelS}
            </Typography>
            <Select
              size="small"
              variant="standard"
              value={modelId ?? ""}
              onChange={handleModelChange}
              sx={{ flex: 1, minWidth: 0, fontSize: 13 }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
            >
              {models.map((m) => (
                <MenuItem key={m.id} value={m.id} sx={{ fontSize: 13 }}>
                  {m.id}
                  {m.isDefault ? " (défaut)" : ""}
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
