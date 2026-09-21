import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Popover,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import { Close, ContentCopy, OpenInNew } from "@mui/icons-material";
import { relayFetch } from "Features/assistantRelay/services/assistantRelayClient";

const euros = (micros) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format((micros ?? 0) / 1000000);
const preciseEuros = (micros) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 4,
  }).format((micros ?? 0) / 1000000);
const tokens = (value) => new Intl.NumberFormat("fr-FR").format(value ?? 0);

export default function ChatBudgetIndicator() {
  // data
  const connected = useSelector(
    (s) => s.assistantRelay.connectionStatus === "connected"
  );
  const token = useSelector((s) => s.assistantRelay.token);
  const conversation = useSelector((s) => s.chat.conversation);
  const thinking = useSelector((s) => s.chat.isThinking);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // state
  const [anchor, setAnchor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [budget, setBudget] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const sessionId = selected ?? conversation.budgetSessionId;

  useEffect(() => {
    setSelected(null);
  }, [conversation.budgetSessionId, token, projectId, scopeId]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    setBudget(null);
    setError(null);
    if (!connected) return;
    async function refresh() {
      try {
        const data = await relayFetch(
          `/chat/budget?sessionId=${encodeURIComponent(sessionId)}`
        );
        if (!cancelled) {
          setBudget(data);
          setError(null);
        }
      } catch {
        if (!cancelled)
          setError(
            "Consommation indisponible. Nouvelle tentative automatique."
          );
      } finally {
        if (!cancelled) timer = setTimeout(refresh, 10000);
      }
    }
    refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    connected,
    token,
    projectId,
    scopeId,
    sessionId,
    conversation.previousResponseId,
    thinking,
  ]);

  // helpers
  const percent =
    budget?.limitMicros > 0
      ? Math.min(100, (budget.spentMicros / budget.limitMicros) * 100)
      : budget
        ? 100
        : 0;
  const color =
    percent >= 100 ? "error" : percent >= 80 ? "warning" : "success";
  const session = budget?.sessions.find((s) => s.id === sessionId);
  const label = budget
    ? `${euros(budget.spentMicros)} consommés sur ${euros(budget.limitMicros)}`
    : "Consommation du budget";
  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setCopied("failed");
    }
  }

  // render
  if (!connected) return null;
  return (
    <>
      <Tooltip title={error ?? label}>
        <IconButton
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={Boolean(anchor)}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ width: 36, height: 36, p: 0.5 }}
        >
          <Box
            sx={{
              position: "relative",
              display: "flex",
              width: 28,
              height: 28,
            }}
          >
            <CircularProgress
              variant="determinate"
              value={100}
              size={28}
              thickness={4}
              sx={{ color: "action.disabledBackground", position: "absolute" }}
            />
            <CircularProgress
              aria-label="Part du budget consommée"
              variant="determinate"
              value={percent}
              color={error ? "warning" : color}
              size={28}
              thickness={4}
            />
            <Typography
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                fontSize: 9,
                color: "text.secondary",
              }}
            >
              {error ? "!" : budget ? `${Math.round(percent)}%` : "…"}
            </Typography>
          </Box>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-label": "Détail du budget IA",
            sx: {
              width: 380,
              maxWidth: "calc(100vw - 32px)",
              borderRadius: 3,
              p: 2,
              mb: 1,
            },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          <Typography fontWeight={600}>Budget IA</Typography>
          <IconButton
            size="small"
            aria-label="Fermer le détail du budget"
            onClick={() => setAnchor(null)}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
        {error ? (
          <Alert severity="warning" sx={{ mb: 1 }}>
            {error}
          </Alert>
        ) : null}
        {budget ? (
          <>
            <Typography sx={{ fontSize: 26, fontWeight: 600 }}>
              {euros(budget.spentMicros)}{" "}
              <Box
                component="span"
                sx={{ fontSize: 15, color: "text.secondary", fontWeight: 400 }}
              >
                / {euros(budget.limitMicros)}
              </Box>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {euros(budget.availableMicros)} disponibles · Crédit sans
              expiration
            </Typography>
            {budget.reservedMicros > 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {euros(budget.reservedMicros)} réservés pour les appels en cours
                ou à vérifier.
              </Typography>
            ) : null}
            {budget.scope === "shared" ? (
              <Typography variant="caption" color="text.secondary">
                Budget commun à la connexion partagée.
              </Typography>
            ) : null}
            {budget.availableMicros === 0 ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Budget disponible épuisé.
              </Alert>
            ) : null}
            <Divider sx={{ my: 1.5 }} />
            <Select
              fullWidth
              size="small"
              value={sessionId}
              onChange={(e) => {
                setSelected(e.target.value);
                setCopied(null);
              }}
              inputProps={{ "aria-label": "Session à consulter" }}
              sx={{ fontSize: 13 }}
            >
              <MenuItem value={conversation.budgetSessionId}>
                {budget.sessions.find(
                  (s) => s.id === conversation.budgetSessionId
                )?.name ?? "Session actuelle"}
              </MenuItem>
              {budget.sessions
                .filter((s) => s.id !== conversation.budgetSessionId)
                .map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
            </Select>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mt: 1,
              }}
            >
              <Typography variant="body2">
                Cette session :{" "}
                <strong>{preciseEuros(session?.costMicros)}</strong>
              </Typography>
              <Tooltip
                title={
                  copied === sessionId
                    ? "Copié"
                    : "Copier l’identifiant de session"
                }
              >
                <IconButton
                  size="small"
                  aria-label="Copier l’identifiant de session"
                  onClick={() => copy(sessionId)}
                >
                  <ContentCopy sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                overflowWrap: "anywhere",
                color: "text.secondary",
              }}
            >
              {sessionId}
            </Typography>
            {copied === "failed" ? (
              <Typography role="status" variant="caption">
                Copie indisponible : sélectionnez l’identifiant ci-dessus.
              </Typography>
            ) : null}
            <Box sx={{ mt: 1, maxHeight: 240, overflowY: "auto" }}>
              {budget.calls.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2 }}
                >
                  Aucune dépense dans cette session.
                </Typography>
              ) : (
                budget.calls.map((call) => (
                  <Box
                    key={call.id}
                    component="details"
                    sx={{
                      py: 1,
                      borderBottom: 1,
                      borderColor: "divider",
                      fontSize: 12,
                    }}
                  >
                    <Box
                      component="summary"
                      sx={{ cursor: "pointer", overflowWrap: "anywhere" }}
                    >
                      {call.kind === "vectorization" ? "PDF · " : ""}
                      {call.model} ·{" "}
                      {call.costMicros === null
                        ? "En cours / à vérifier"
                        : preciseEuros(call.costMicros)}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(call.createdAt).toLocaleString("fr-FR")}
                    </Typography>
                    {call.usage ? (
                      <Typography
                        variant="caption"
                        sx={{ display: "block", my: 0.5 }}
                      >
                        Entrée : {tokens(call.usage.inputTokens)} tokens, dont{" "}
                        {tokens(call.usage.cachedTokens)} en cache.
                        <br />
                        Sortie : {tokens(call.usage.outputTokens)}, dont{" "}
                        {tokens(call.usage.reasoningTokens)} de raisonnement.
                      </Typography>
                    ) : null}
                    {call.responseId ? (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ overflowWrap: "anywhere", minWidth: 0 }}
                        >
                          {call.responseId}
                        </Typography>
                        <IconButton
                          size="small"
                          aria-label="Copier l’identifiant OpenAI"
                          onClick={() => copy(call.responseId)}
                        >
                          <ContentCopy sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ) : null}
                  </Box>
                ))
              )}
            </Box>
            {session?.calls > budget.calls.length ? (
              <Typography variant="caption">
                Les 100 derniers appels sont affichés. Le total couvre toute la
                session.
              </Typography>
            ) : null}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1.5 }}
            >
              Coût estimé selon les tokens, les tarifs et le taux de conversion
              configurés, hors taxes. Les réservations sont ajustées à la fin
              des appels.
            </Typography>
            <Button
              size="small"
              href="https://platform.openai.com/logs"
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
              sx={{ mt: 1 }}
            >
              Logs OpenAI
            </Button>
          </>
        ) : !error ? (
          <Typography variant="body2" color="text.secondary">
            Chargement de la consommation…
          </Typography>
        ) : null}
      </Popover>
    </>
  );
}
