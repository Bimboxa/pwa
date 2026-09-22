import { jwtDecode } from "jwt-decode";
import { useDispatch, useSelector } from "react-redux";

import { resetConversation } from "../chatSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import theme from "Styles/theme";
import useAssistantRelayToken from "Features/assistantRelay/hooks/useAssistantRelayToken";
import { selectRelayBaseUrl } from "Features/assistantRelay/utils/relayConnection.js";

const RELAY_STATUS = {
  idle: { label: "Serveur IA non connecté", color: "text.disabled" },
  checking: { label: "Vérification du serveur IA…", color: "text.disabled" },
  connected: { label: "Serveur IA connecté", color: "success.main" },
  error: { label: "Serveur IA : erreur", color: "error.main" },
};

// Slim title bar: the target listing, the relay status (a dot, click = edit
// the pairing key) and "Nouvelle session". In Debug (PWA_KEY) mode a "Debug"
// strip sits on top and the status tooltip describes the key connection
// instead of the (irrelevant) JWT user.
export default function ChatHeader({ showRelayStatus, onRelayStatusClick }) {
  const dispatch = useDispatch();

  // strings

  const newSessionS = "Nouvelle session";
  const runningS = "Analyse en cours : terminez-la ou annulez-la d'abord.";
  const { token, mode } = useAssistantRelayToken();
  const editKeyS = mode === "jwt" ? "détails de connexion" : "modifier la clé";
  const noListingS = "Assistant";
  const debugS = "Debug — connexion avec la clé du serveur (PWA_KEY)";

  // data

  const { value: listing } = useSelectedListing();
  const hasMessages = useSelector((s) => s.chat.messages.length > 0);
  const hasPendingPdf = useSelector((s) => Boolean(s.chat.pendingPdf));
  const hasActiveRun = useSelector((s) => Boolean(s.chat.vectorization));
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
  const titleS = listing?.name ? `Liste ${listing.name}` : noListingS;
  const status = RELAY_STATUS[connectionStatus] ?? RELAY_STATUS.idle;
  const canReset = (hasMessages || hasPendingPdf) && !hasActiveRun;

  // handlers

  function handleNewSession() {
    dispatch(resetConversation());
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

        <Tooltip title={hasActiveRun ? runningS : ""}>
          {/* span: a disabled button does not fire the tooltip events */}
          <span>
            <Button
              size="small"
              color="inherit"
              startIcon={<AddIcon />}
              disabled={!canReset}
              onClick={handleNewSession}
              sx={{ color: "text.secondary", whiteSpace: "nowrap" }}
            >
              {newSessionS}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </>
  );
}
