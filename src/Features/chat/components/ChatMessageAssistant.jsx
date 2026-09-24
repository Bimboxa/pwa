import { useId, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { updateMessageAction } from "../chatSlice";

import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Popover,
  Tooltip,
  Stack,
  Typography,
} from "@mui/material";
import {
  CheckCircle as DoneIcon,
  Troubleshoot as DiagnosticIcon,
  ErrorOutline as ErrorIcon,
  HourglassEmpty as PendingIcon,
} from "@mui/icons-material";

import {
  describeRelayError,
  undoLiveJob,
} from "Features/assistantRelay/services/assistantRelayClient";
import { groupDetectionDebug } from "../utils/groupDetectionDebug";
import ChatDetectionDebug from "./ChatDetectionDebug";
import ChatTimeline from "./ChatTimeline";
import ThinkingBubble from "./ThinkingBubble";
import ChatText from "./ChatText";
import ChatRecoverDrawing from "./ChatRecoverDrawing";
import ChatDrawingDiagnostic from "./ChatDrawingDiagnostic";
import { drawingLiveStatus } from "../utils/recoverChatDrawing";
import { CHAT_TOOL_LABELS, formatChatElapsed } from "../utils/chatProgress";

const UNDOABLE = new Set([
  "draw_annotations",
  "update_annotations_batch",
  "create_annotation_templates",
  "create_annotation_listing",
]);

function ActionIcon({ action, stopped }) {
  if (stopped && action.phase === "started")
    return <PendingIcon fontSize="small" color="disabled" />;
  if (action.phase === "started")
    return <CircularProgress size={13} thickness={5} color="inherit" />;
  if (action.phase === "failed" || action.liveStatus === "failed")
    return <ErrorIcon fontSize="small" color="error" />;
  if (action.liveStatus === "pending" || action.liveStatus === "discarded")
    return <PendingIcon fontSize="small" color="warning" />;
  return <DoneIcon fontSize="small" color="success" />;
}

function actionText(action, stopped) {
  const label = CHAT_TOOL_LABELS[action.name] ?? action.name;
  if (stopped && action.phase === "started")
    return `${label} — suivi interrompu`;
  if (action.undone) return `${label} — annulé`;
  if (action.phase === "started") return `${label}…`;
  if (action.liveStatus === "pending")
    return `${label} — envoyé, pas encore appliqué`;
  if (action.liveStatus === "discarded")
    return `${label} — expiré ou abandonné`;
  if (action.phase === "failed" || action.liveStatus === "failed")
    return `${label} — échec`;
  return label;
}

// Answer of a conversational turn: what the model did (one line per tool
// call, with an undo for what it drew) and what it said.
export default function ChatMessageAssistant({ message }) {
  const dispatch = useDispatch();
  const diagnosticId = useId();
  const [diagnosticAnchor, setDiagnosticAnchor] = useState(null);
  const [busyCallId, setBusyCallId] = useState(null);
  // Reading tools are noise once they have succeeded.
  const jobsById = useSelector((state) => state.assistantRelay.jobsById);
  const actions = (message.actions ?? []).map((action) => {
    const job = jobsById?.[action.jobId];
    return job && action.name === "draw_annotations"
      ? { ...action, liveStatus: drawingLiveStatus(job.status) }
      : action;
  });
  const finished = !message.progress;
  const completed =
    finished &&
    !message.error &&
    !message.stopped &&
    actions.every(
      (action) =>
        action.phase === "done" &&
        !["pending", "discarded", "failed"].includes(action.liveStatus) &&
        (action.name !== "draw_annotations" ||
          action.undone ||
          action.liveStatus === "applied") &&
        !action.undoError &&
        !action.recoveryError
    );
  const durationMs = message.totalDurationMs ?? message.durationMs;
  const visibleActions = actions.filter(
    (a) =>
      UNDOABLE.has(a.name) ||
      a.name === "undo_drawing" ||
      a.name === "request_plan_image" ||
      a.phase !== "done"
  );

  async function handleUndo(action) {
    setBusyCallId(action.callId);
    try {
      await undoLiveJob(action.jobId);
      dispatch(
        updateMessageAction({
          id: message.id,
          callId: action.callId,
          changes: { undone: true, undoError: null },
        })
      );
    } catch (e) {
      dispatch(
        updateMessageAction({
          id: message.id,
          callId: action.callId,
          changes: {
            undoError: e?.code ? describeRelayError(e) : e?.message,
            ...(e?.code === "ALREADY_UNDONE" ? { undone: true } : {}),
          },
        })
      );
    } finally {
      setBusyCallId(null);
    }
  }

  const actionDetails = (
    <>
      {visibleActions.length > 0 ? (
        <Stack spacing={0.25} sx={{ mb: message.content ? 1 : 0 }}>
          {visibleActions.map((action) => (
            <Box key={action.callId}>
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={{ color: "text.secondary", minHeight: 26 }}
              >
                <Box
                  sx={{
                    width: 16,
                    display: "flex",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ActionIcon action={action} stopped={message.stopped} />
                </Box>
                <Typography variant="body2" color="inherit" sx={{ flex: 1 }}>
                  {actionText(action, message.stopped)}
                </Typography>
                {UNDOABLE.has(action.name) &&
                action.jobId &&
                action.liveStatus === "applied" &&
                !action.undone ? (
                  <Button
                    size="small"
                    color="inherit"
                    disabled={busyCallId === action.callId}
                    onClick={() => handleUndo(action)}
                  >
                    Annuler
                  </Button>
                ) : null}
              </Stack>
              {action.name === "draw_annotations" &&
              action.jobId &&
              ["pending", "discarded"].includes(action.liveStatus) &&
              !action.undone ? (
                <ChatRecoverDrawing messageId={message.id} action={action} />
              ) : null}
              {action.name === "draw_annotations" &&
              action.jobId &&
              ["pending", "discarded", "failed"].includes(action.liveStatus) ? (
                <ChatDrawingDiagnostic jobId={action.jobId} />
              ) : null}
              {action.recoveryError && action.liveStatus !== "applied" ? (
                <Typography
                  role="alert"
                  variant="caption"
                  color="error"
                  sx={{ display: "block", pl: "22px" }}
                >
                  {action.recoveryError}
                </Typography>
              ) : null}
              {action.name === "draw_annotations" &&
              action.liveStatus === "applied" &&
              !action.undone ? (
                <Typography
                  role="status"
                  variant="caption"
                  color="success.main"
                  sx={{ display: "block", pl: "22px" }}
                >
                  Annotations appliquées au plan.
                </Typography>
              ) : null}
              {action.undoError ? (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ display: "block", pl: "22px" }}
                >
                  {action.undoError}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Stack>
      ) : null}
    </>
  );

  // No bubble: tool lines in a muted tone, then the answer as plain text.
  return (
    <Box sx={{ minWidth: 0 }}>
      {!finished && message.planStatus && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 0.5 }}
        >
          {message.planStatus}
        </Typography>
      )}
      {!completed ? actionDetails : null}
      {message.content ? <ChatText text={message.content} /> : null}
      {message.progress && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ThinkingBubble progress={message.progress} />
          </Box>
          <Button
            size="small"
            aria-haspopup="dialog"
            aria-expanded={Boolean(diagnosticAnchor)}
            aria-controls={diagnosticAnchor ? diagnosticId : undefined}
            onClick={(event) =>
              setDiagnosticAnchor({
                top: event.currentTarget.getBoundingClientRect().bottom,
                left: event.currentTarget.getBoundingClientRect().right,
              })
            }
          >
            Étapes
          </Button>
        </Stack>
      )}
      {message.stopped ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Réponse interrompue.
        </Typography>
      ) : null}
      {finished ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{ mt: 0.5 }}
        >
          {completed ? <DoneIcon fontSize="small" color="success" /> : null}
          <Typography
            role="status"
            variant="caption"
            color="text.secondary"
            sx={{ flex: 1 }}
          >
            {completed
              ? "Terminé"
              : message.error || message.stopped
                ? "Traitement interrompu"
                : "État des actions à vérifier"}
            {durationMs != null ? ` · ${formatChatElapsed(0, durationMs)}` : ""}
          </Typography>
          <Tooltip title="Diagnostic du traitement">
            <IconButton
              size="small"
              aria-label="Ouvrir le diagnostic du traitement"
              aria-haspopup="dialog"
              aria-expanded={Boolean(diagnosticAnchor)}
              aria-controls={diagnosticAnchor ? diagnosticId : undefined}
              onClick={(event) =>
                setDiagnosticAnchor({
                  top: event.currentTarget.getBoundingClientRect().bottom,
                  left: event.currentTarget.getBoundingClientRect().right,
                })
              }
            >
              <DiagnosticIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : null}
      <Popover
        open={Boolean(diagnosticAnchor)}
        anchorReference="anchorPosition"
        anchorPosition={diagnosticAnchor ?? undefined}
        onClose={() => setDiagnosticAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 420,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "70vh",
              p: 2,
            },
          },
        }}
      >
        <Box
          role="dialog"
          id={diagnosticId}
          aria-labelledby={`${diagnosticId}-title`}
        >
          <Typography
            id={`${diagnosticId}-title`}
            variant="subtitle2"
            sx={{ mb: 1 }}
          >
            Diagnostic du traitement
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Ces informations permettent de comprendre le traitement et
            d’analyser un résultat inattendu. La durée totale inclut la
            préparation, les échanges avec le serveur et la réponse.
          </Typography>
          {message.planStatus ? (
            <Typography variant="caption" color="text.secondary">
              {message.planStatus}
            </Typography>
          ) : null}
          <ChatTimeline
            timeline={message.timeline}
            active={Boolean(message.progress)}
          />
          {actionDetails}
          {message.reasoningSummary && (
            <Box component="details" sx={{ mt: 0.5, color: "text.secondary" }}>
              <Typography
                component="summary"
                variant="caption"
                sx={{ cursor: "pointer" }}
              >
                Résumé de réflexion
              </Typography>
              <ChatText text={message.reasoningSummary} />
            </Box>
          )}
          {message.models?.length ? (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Modèles utilisés : {message.models.join(" → ")}
            </Typography>
          ) : null}
          {groupDetectionDebug(message.detectionDebug).map((record) => (
            <ChatDetectionDebug
              key={record.id}
              record={record}
              active={Boolean(message.progress)}
            />
          ))}
          {!message.detectionDebug?.length ? (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mt: 1 }}
            >
              Aucun artefact de détection à exporter pour ce traitement.
            </Typography>
          ) : null}
        </Box>
      </Popover>
      {message.error ? (
        <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
          {message.error}
        </Typography>
      ) : null}
    </Box>
  );
}
