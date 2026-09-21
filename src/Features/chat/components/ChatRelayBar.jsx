import { useEffect, useId, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setReasoningLevelId, setReasoningLevels } from "../chatSlice";

import {
  Box,
  Button,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { LEVEL_STORAGE_KEY } from "./ChatLevelSelect";

import useAssistantRelayToken from "Features/assistantRelay/hooks/useAssistantRelayToken";
import {
  describeRelayError,
  fetchReasoningLevels,
} from "Features/assistantRelay/services/assistantRelayClient";

// These are possible causes, not a diagnosis: authentication failures deliberately
// do not disclose which part of a credential failed validation.
function getConnectionHelp(code, mode) {
  if (code === "UNAUTHORIZED") {
    return mode === "jwt"
      ? "Le serveur IA n’a pas accepté le jeton de votre session. Il peut être expiré, ou le serveur peut utiliser un autre mode de connexion ou une configuration JWT différente. Reconnectez-vous à l’application, puis vérifiez le mode JWT et l’adresse du serveur dans Configuration → Chat. Si le refus persiste, l’administrateur doit vérifier le mode JWT du serveur et les valeurs JWT_KEY, JWT_ISSUER et JWT_AUDIENCE, qui doivent correspondre à celles du service de connexion. La réponse du serveur ne précise pas la cause exacte."
      : "Le serveur IA n’a pas accepté la clé d’appairage. Vérifiez l’adresse du serveur et le mode PWA_KEY dans Configuration → Chat, puis saisissez la clé fournie par l’administrateur. Celui-ci doit vérifier que le serveur utilise le mode shared-token et que la clé correspond à son PWA_TOKEN. La réponse du serveur ne précise pas la cause exacte.";
  }
  if (code === "NETWORK") {
    return "La PWA n’arrive pas à joindre le serveur IA. Vérifiez votre connexion et l’adresse dans Configuration → Chat. Si le serveur est accessible, l’administrateur doit vérifier qu’il autorise les connexions depuis cette application (CORS).";
  }
  return "La connexion au serveur IA n’a pas pu être établie. Vérifiez le mode de connexion et l’adresse du serveur dans Configuration → Chat. Si le problème persiste, transmettez le message affiché à l’administrateur, sans partager votre jeton de session ni votre clé.";
}

// Under the header: user-session status or manual relay pairing key. Shown only
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

  const { token, setToken, mode } = useAssistantRelayToken();
  const connectionStatus = useSelector(
    (s) => s.assistantRelay.connectionStatus
  );
  const connectionError = useSelector((s) => s.assistantRelay.connectionError);
  const connectionErrorCode = useSelector(
    (s) => s.assistantRelay.connectionErrorCode
  );
  const helpId = useId();
  const connected = connectionStatus === "connected";

  // state

  const [expandedError, setExpandedError] = useState(null);
  const errorKey = JSON.stringify([
    connectionStatus,
    connectionErrorCode,
    connectionError,
    mode,
  ]);
  const showErrorHelp = expandedError === errorKey;
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

  const showKeyForm =
    mode === "PWA_KEY" && (!token || editing || connectionStatus === "error");
  const showSessionInfo =
    mode !== "PWA_KEY" && (!token || editing || connectionStatus === "error");
  const showModelsError = connected && Boolean(modelsError);
  if (!showKeyForm && !showModelsError && !showSessionInfo) return null;

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
      {showSessionInfo ? (
        <Typography variant="caption" color="text.secondary">
          {mode !== "jwt"
            ? "Mode de connexion du Chat invalide."
            : token
              ? "Connexion avec votre session utilisateur."
              : "Connectez-vous à l’application pour utiliser le Chat."}
        </Typography>
      ) : null}
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
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="caption" color="error">
              {connectionError}
            </Typography>
            <Tooltip title="Comprendre cette erreur">
              <IconButton
                size="small"
                aria-label="Comprendre l’erreur de connexion"
                aria-expanded={showErrorHelp}
                aria-controls={showErrorHelp ? helpId : undefined}
                onClick={() =>
                  setExpandedError(showErrorHelp ? null : errorKey)
                }
                sx={{ color: "text.secondary", p: 0.5, flexShrink: 0 }}
              >
                <InfoOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          {showErrorHelp ? (
            <Typography
              id={helpId}
              component="p"
              variant="caption"
              color="text.secondary"
              sx={{
                mt: 0.75,
                p: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                lineHeight: 1.6,
              }}
            >
              {getConnectionHelp(connectionErrorCode, mode)}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      {connected && modelsError ? (
        <Typography variant="caption" color="error">
          {modelsError}
        </Typography>
      ) : null}
      {!token && mode === "PWA_KEY" ? (
        <Typography variant="caption" color="text.secondary">
          {hintS}
        </Typography>
      ) : null}
    </Box>
  );
}
