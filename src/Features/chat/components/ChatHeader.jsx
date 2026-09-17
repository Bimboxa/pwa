import { useDispatch, useSelector } from "react-redux";

import { resetConversation } from "../chatSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import theme from "Styles/theme";

const RELAY_STATUS = {
  idle: { label: "Serveur IA non connecté", color: "text.disabled" },
  checking: { label: "Vérification du serveur IA…", color: "text.disabled" },
  connected: { label: "Serveur IA connecté", color: "success.main" },
  error: { label: "Serveur IA : erreur", color: "error.main" },
};

// Slim title bar: the target listing, the relay status (a dot, click = edit
// the pairing key) and "Nouvelle session".
export default function ChatHeader({ showRelayStatus, onRelayStatusClick }) {
  const dispatch = useDispatch();

  // strings

  const newSessionS = "Nouvelle session";
  const runningS = "Analyse en cours : terminez-la ou annulez-la d'abord.";
  const editKeyS = "modifier la clé";
  const noListingS = "Assistant";

  // data

  const { value: listing } = useSelectedListing();
  const hasMessages = useSelector((s) => s.chat.messages.length > 0);
  const hasPendingPdf = useSelector((s) => Boolean(s.chat.pendingPdf));
  const hasActiveRun = useSelector((s) => Boolean(s.chat.vectorization));
  const connectionStatus = useSelector(
    (s) => s.assistantRelay.connectionStatus
  );

  // helpers

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
        <Tooltip title={`${status.label} — ${editKeyS}`}>
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
  );
}
