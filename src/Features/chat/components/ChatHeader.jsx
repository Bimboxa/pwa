import { useState } from "react";
import ChatSessionNavigation from "./ChatSessionNavigation";
import {
  cancelVectorization,
  describeRelayError,
  relayFetch,
} from "Features/assistantRelay/services/assistantRelayClient";
import { jwtDecode } from "jwt-decode";
import { useDispatch, useSelector } from "react-redux";

import {
  refreshBudget,
  resetConversation,
  selectSession,
  setVectorization,
  updateMessageById,
} from "../chatSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Add as AddIcon,
  ExpandMore,
  Stop,
  PlayArrow,
  Check,
} from "@mui/icons-material";
import { saveVectorizationPointer } from "Features/assistantRelay/utils/vectorizationPointer";
import theme from "Styles/theme";
import useAssistantRelayToken from "Features/assistantRelay/hooks/useAssistantRelayToken";
import { selectRelayBaseUrl } from "Features/assistantRelay/utils/relayConnection.js";

const RELAY_STATUS = {
  idle: { label: "Serveur IA non connecté", color: "text.disabled" },
  checking: { label: "Vérification du serveur IA…", color: "text.disabled" },
  connected: { label: "Serveur IA connecté", color: "success.main" },
  error: { label: "Serveur IA : erreur", color: "error.main" },
};

// The session selector remains available while another session is running.
// The listing colour and connection status keep their existing meaning.
export default function ChatHeader({
  showRelayStatus,
  onRelayStatusClick,
  sending,
  onStop,
  onPlay,
  canResume,
}) {
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useState(null);
  const [stopping, setStopping] = useState(false);
  const [budgetNotice, setBudgetNotice] = useState(null);

  // strings

  const newSessionS = "Nouvelle session";
  const { token, mode } = useAssistantRelayToken();
  const editKeyS = mode === "jwt" ? "détails de connexion" : "modifier la clé";
  const debugS = "Debug — connexion avec la clé du serveur (PWA_KEY)";

  // data

  const { value: listing } = useSelectedListing();
  const mainBaseMap = useMainBaseMap();
  const isDrawingModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "MAP"
  );
  const sessions = useSelector((s) => s.chat.sessions);
  const sessionIds = useSelector((s) => s.chat.sessionIds);
  const sessionId = useSelector((s) => s.chat.sessionId);
  const activeRun = useSelector((s) => s.chat.vectorization);
  const sessionTitle = (session) =>
    session.conversation.sessionName ||
    session.messages.find((m) => m.role === "user")?.content?.slice(0, 80) ||
    `Session ${session.sessionId + 1}`;
  const connectionStatus = useSelector(
    (s) => s.assistantRelay.connectionStatus
  );

  const jwtVerificationSkipped = useSelector(
    (s) => s.assistantRelay.jwtVerificationSkipped
  );
  const baseUrl = useSelector(selectRelayBaseUrl);

  // helpers

  // Display only: decoding claims here never marks the server as connected.
  let trigram = null;
  if (mode === "jwt" && token) {
    try {
      const name =
        jwtDecode(token)[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
        ];
      if (typeof name === "string" && name.trim() && name.length <= 200)
        trigram = name;
    } catch {
      // Invalid payload: keep the status visible without disclosing the token.
    }
  }

  const isDebug = mode === "PWA_KEY";

  // Never disclose the key: only its last 4 characters.
  const keyHintS = token
    ? `Clé : ••••${token.length > 8 ? token.slice(-4) : ""}`
    : "Clé : non renseignée";
  let serverS = "Serveur : non configuré";
  try {
    if (baseUrl) serverS = `Serveur : ${new URL(baseUrl).host}`;
  } catch {
    serverS = `Serveur : ${baseUrl}`;
  }

  const color = listing?.color ?? theme.palette.secondary.main;
  const titleS = sessionTitle(sessions[sessionId]);
  const status = RELAY_STATUS[connectionStatus] ?? RELAY_STATUS.idle;

  // handlers

  async function handleStop() {
    onStop?.();
    if (!activeRun || stopping) return;
    setStopping(true);
    try {
      const run = await cancelVectorization(activeRun.runId);
      dispatch(
        updateMessageById({ id: activeRun.messageId, changes: { run } })
      );
      if (["cancelled", "completed", "failed"].includes(run.status)) {
        dispatch(setVectorization(null));
        saveVectorizationPointer(null, sessionId);
      }
    } catch (error) {
      setBudgetNotice(describeRelayError(error));
    } finally {
      setStopping(false);
    }
  }

  async function handleNewSession() {
    setAnchorEl(null);
    dispatch(
      resetConversation({
        baseMapName: isDrawingModule ? mainBaseMap?.name : null,
      })
    );
    setBudgetNotice(null);
    if (connectionStatus !== "connected") return;

    try {
      const budget = await relayFetch("/chat/budget/reconcile", {
        method: "POST",
      });
      const remaining = new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(budget.reservedMicros / 1000000);
      setBudgetNotice(
        budget.reservedMicros > 0
          ? `Budget vérifié : ${remaining} restent réservés pour des appels en cours ou à vérifier.`
          : "Budget vérifié : aucune somme réservée."
      );
    } catch {
      setBudgetNotice(
        "Nouvelle session créée. Vérification du budget indisponible ; les réservations sont conservées."
      );
    } finally {
      dispatch(refreshBudget());
    }
  }

  // render — dark, like the panel; the listing colour stays as an accent.

  return (
    <>
      {isDebug ? (
        <Box
          sx={{
            px: 1.5,
            py: 0.25,
            bgcolor: "warning.main",
            color: "warning.contrastText",
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
            {debugS}
          </Typography>
        </Box>
      ) : null}
      <Box
        sx={{
          pl: 1.5,
          pr: 1,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          bgcolor: "background.default",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "divider",
          borderLeft: `3px solid ${color}`,
        }}
      >
        <ChatSessionNavigation />
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}
        >
          {titleS}
        </Typography>

        {showRelayStatus ? (
          <Tooltip
            title={
              <Box>
                <Box>{status.label}</Box>
                {isDebug ? (
                  <>
                    <Box>Mode Debug : clé du serveur (PWA_KEY)</Box>
                    <Box>{keyHintS}</Box>
                    <Box>{serverS}</Box>
                  </>
                ) : null}
                {mode === "jwt" ? (
                  <Box>Trigramme du JWT : {trigram ?? "indisponible"}</Box>
                ) : null}
                {mode === "jwt" &&
                connectionStatus === "connected" &&
                jwtVerificationSkipped ? (
                  <Box>Mode temporaire : JWT accepté sans vérification.</Box>
                ) : null}
                <Box>{editKeyS}</Box>
              </Box>
            }
          >
            <IconButton
              size="small"
              aria-label={status.label}
              onClick={onRelayStatusClick}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: status.color,
                }}
              />
            </IconButton>
          </Tooltip>
        ) : null}

        <Tooltip title="Choisir une session">
          <IconButton
            size="small"
            aria-label="Choisir une session"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchorEl)}
            aria-controls={anchorEl ? `chat-sessions-${sessionId}` : undefined}
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            <ExpandMore />
          </IconButton>
        </Tooltip>
        <Menu
          id={`chat-sessions-${sessionId}`}
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{
            paper: {
              sx: {
                maxHeight: 360,
                width: 320,
                maxWidth: "calc(100vw - 32px)",
              },
            },
          }}
        >
          {sessionIds.map((id) => (
            <MenuItem
              key={id}
              selected={id === sessionId}
              onClick={() => {
                setAnchorEl(null);
                dispatch(selectSession(id));
              }}
            >
              <ListItemIcon>
                {id === sessionId ? <Check fontSize="small" /> : null}
              </ListItemIcon>
              <ListItemText
                primary={sessionTitle(sessions[id])}
                secondary={
                  sessions[id].sending || sessions[id].vectorization
                    ? "En cours…"
                    : undefined
                }
                slotProps={{ primary: { noWrap: true } }}
              />
            </MenuItem>
          ))}
          <Divider />
          <MenuItem onClick={handleNewSession}>
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{newSessionS}</ListItemText>
          </MenuItem>
        </Menu>
        <Tooltip
          title={
            canResume && !sending && !activeRun
              ? "Reprendre la réponse"
              : "Stop — interrompre la session"
          }
        >
          <span>
            <IconButton
              size="small"
              aria-label={
                canResume && !sending && !activeRun
                  ? "Reprendre la réponse"
                  : "Stop — interrompre la session"
              }
              disabled={stopping || (!sending && !canResume && !activeRun)}
              onClick={sending || activeRun ? handleStop : onPlay}
            >
              {canResume && !sending && !activeRun ? (
                <PlayArrow fontSize="small" />
              ) : (
                <Stop fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      {budgetNotice && (
        <Typography
          role="status"
          variant="caption"
          color="text.secondary"
          sx={{ px: 1.5, py: 0.5 }}
        >
          {budgetNotice}
        </Typography>
      )}
    </>
  );
}
