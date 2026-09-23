import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setChatConnection } from "Features/appConfig/appConfigSlice";
import { setAssistantRelayToken } from "Features/assistantRelay/assistantRelaySlice";

import {
  selectRelayConnectionMode,
  selectRelayBaseUrl,
  selectSavedChatConnection,
  normalizeRelayBaseUrl,
} from "Features/assistantRelay/utils/relayConnection.js";

import {
  Alert,
  Box,
  Button,
  Chip,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import PageConfigLayout from "./PageConfigLayout";
import useAssistantRelayToken from "Features/assistantRelay/hooks/useAssistantRelayToken";
import useAssistantRelaySession from "Features/assistantRelay/hooks/useAssistantRelaySession";

import setChatConnectionInLocalStorage from "Features/appConfig/services/setChatConnectionInLocalStorage";
import {
  readPairingKey,
  writePairingKey,
} from "Features/assistantRelay/utils/pairingKeyStorage.js";

// "Généralités > Serveur Chat" page: app-level (device) Chat server
// connection overriding the organization defaults. Available without a
// selected scope.
// - Production = "jwt" mode: the user session authenticates, only the URL.
// - Debug = "PWA_KEY" mode: the server pairing key + the URL.
export default function PageChatConnection() {
  const dispatch = useDispatch();

  // data

  const mode = useSelector(selectRelayConnectionMode);
  const baseUrl = useSelector(selectRelayBaseUrl);
  const saved = useSelector(selectSavedChatConnection);
  const pairingKey = useSelector((s) => s.assistantRelay.token);
  useAssistantRelayToken();
  const { connected, connectionStatus, connectionError, refresh } =
    useAssistantRelaySession();
  const connectionErrorCode = useSelector(
    (s) => s.assistantRelay.connectionErrorCode
  );

  // state

  const [draftMode, setDraftMode] = useState(mode);
  const [draftUrl, setDraftUrl] = useState(baseUrl);
  const [draftKey, setDraftKey] = useState(
    () => pairingKey ?? readPairingKey() ?? ""
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraftMode(mode);
    setDraftUrl(baseUrl);
    setError(null);
  }, [mode, baseUrl]);

  useEffect(() => {
    if (pairingKey) setDraftKey(pairingKey);
  }, [pairingKey]);

  // helpers

  const isDebug = draftMode === "PWA_KEY";
  const canSave = Boolean(draftUrl.trim()) && (!isDebug || draftKey.trim());

  const hasUnsavedChanges =
    draftMode !== mode ||
    draftUrl.trim().replace(/\/+$/, "") !== baseUrl ||
    (isDebug && draftKey.trim() !== (pairingKey ?? ""));
  const statusLabel = hasUnsavedChanges
    ? "Modifications non enregistrées"
    : connectionStatus === "checking"
      ? "Connexion en cours…"
      : connected
        ? "Connexion établie"
        : connectionStatus === "error"
          ? "Connexion impossible"
          : "Non connecté";
  const statusColor = hasUnsavedChanges
    ? "default"
    : connected
      ? "success"
      : connectionStatus === "error"
        ? "error"
        : "default";

  // handlers

  function handleModeChange(_, value) {
    if (value) setDraftMode(value);
  }

  function save(reset = false) {
    setError(null);
    try {
      const connection = reset
        ? null
        : { mode: draftMode, baseUrl: normalizeRelayBaseUrl(draftUrl) };
      if (!reset && isDebug)
        dispatch(setAssistantRelayToken(writePairingKey(draftKey)));
      setChatConnectionInLocalStorage(connection);
      dispatch(setChatConnection(connection));
      // Changed credentials/config reconnect through the session hook.
      // Saving unchanged settings also retries a failed connection.
      if (!reset && !hasUnsavedChanges) void refresh();
    } catch (e) {
      setError(e.message || "Enregistrement impossible.");
    }
  }

  // render

  return (
    <PageConfigLayout title="Serveur Chat">
      <WhiteSectionGeneric>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <WhiteSectionTitle>Connexion au serveur Chat</WhiteSectionTitle>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={draftMode}
            onChange={handleModeChange}
          >
            <ToggleButton value="jwt">Production</ToggleButton>
            <ToggleButton value="PWA_KEY">Debug</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary">
            {isDebug
              ? "Connexion avec la clé du serveur (PWA_KEY), sans session utilisateur."
              : "Connexion avec votre session utilisateur (JWT)."}
          </Typography>
          {isDebug && (
            <TextField
              fullWidth
              size="small"
              type="password"
              label="Clé du serveur (PWA_KEY)"
              value={draftKey}
              autoComplete="off"
              onChange={(e) => setDraftKey(e.target.value)}
              helperText="Conservée sur cet appareil uniquement."
            />
          )}
          <TextField
            fullWidth
            size="small"
            label="URL du serveur Chat"
            value={draftUrl}
            placeholder="https://serveur.example.com"
            onChange={(e) => setDraftUrl(e.target.value)}
            helperText="Adresse de base du serveur, sans ajouter /bridge ou /chat/turns."
          />
          <Typography variant="caption" color="text.secondary">
            {saved
              ? "Réglages enregistrés sur cet appareil."
              : "Valeurs par défaut de l’organisation."}
          </Typography>
          <Box role="status" aria-live="polite">
            <Chip size="small" label={statusLabel} color={statusColor} />
          </Box>
          {!hasUnsavedChanges && connectionStatus === "error" && (
            <Alert severity="error">
              {mode === "PWA_KEY" &&
              connectionErrorCode === "APPLICATION_CONTEXT_REQUIRED"
                ? "Le serveur attend une session JWT. Choisissez Production, ou configurez le serveur avec PWA_AUTH_MODE=shared-token pour utiliser le mode Debug."
                : connectionError}
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              justifyContent: "flex-end",
            }}
          >
            <Button size="small" disabled={!saved} onClick={() => save(true)}>
              Rétablir les valeurs par défaut
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={!canSave}
              onClick={() => save()}
            >
              Enregistrer
            </Button>
          </Box>
        </Box>
      </WhiteSectionGeneric>
    </PageConfigLayout>
  );
}
