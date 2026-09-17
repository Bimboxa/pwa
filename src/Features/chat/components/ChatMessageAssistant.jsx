import { useState } from "react";
import { useDispatch } from "react-redux";

import { updateMessageAction } from "../chatSlice";

import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  CheckCircle as DoneIcon,
  ErrorOutline as ErrorIcon,
  HourglassEmpty as PendingIcon,
} from "@mui/icons-material";

import {
  describeRelayError,
  undoLiveJob,
} from "Features/assistantRelay/services/assistantRelayClient";

const TOOL_LABELS = {
  draw_annotations: "Dessin",
  create_annotation_templates: "Création de modèles d'annotation",
  create_annotation_listing: "Création d'une liste",
  undo_drawing: "Annulation d'un dessin",
  get_current_base_map: "Lecture du fond de plan",
  get_detection_instructions: "Lecture des consignes",
  get_detection_job: "Vérification d'un dessin",
  request_plan_image: "Lecture du plan (image)",
};
const UNDOABLE = new Set([
  "draw_annotations",
  "create_annotation_templates",
  "create_annotation_listing",
]);

function ActionIcon({ action }) {
  if (action.phase === "started") return <CircularProgress size={14} />;
  if (action.phase === "failed" || action.liveStatus === "failed")
    return <ErrorIcon fontSize="small" color="error" />;
  if (action.liveStatus === "pending" || action.liveStatus === "discarded")
    return <PendingIcon fontSize="small" color="warning" />;
  return <DoneIcon fontSize="small" color="success" />;
}

function actionText(action) {
  const label = TOOL_LABELS[action.name] ?? action.name;
  if (action.undone) return `${label} — annulé`;
  if (action.phase === "started") return `${label}…`;
  if (action.liveStatus === "pending")
    return `${label} — envoyé, pas encore appliqué`;
  if (action.liveStatus === "discarded") return `${label} — abandonné`;
  if (action.phase === "failed" || action.liveStatus === "failed")
    return `${label} — échec`;
  return label;
}

// Answer of a conversational turn: what the model did (one line per tool
// call, with an undo for what it drew) and what it said.
export default function ChatMessageAssistant({ message }) {
  const dispatch = useDispatch();
  const [busyCallId, setBusyCallId] = useState(null);
  // Reading tools are noise once they have succeeded.
  const actions = (message.actions ?? []).filter(
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

  return (
    <Box display="flex" justifyContent="flex-start">
      <Paper
        sx={{
          p: 1.5,
          maxWidth: "90%",
          backgroundColor: "#e0e0e0",
          borderRadius: 2,
        }}
      >
        {actions.length > 0 ? (
          <Stack spacing={0.5} sx={{ mb: message.content ? 1 : 0 }}>
            {actions.map((action) => (
              <Box key={action.callId}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ActionIcon action={action} />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {actionText(action)}
                  </Typography>
                  {UNDOABLE.has(action.name) &&
                  action.jobId &&
                  action.liveStatus === "applied" &&
                  !action.undone ? (
                    <Button
                      size="small"
                      disabled={busyCallId === action.callId}
                      onClick={() => handleUndo(action)}
                    >
                      Annuler
                    </Button>
                  ) : null}
                </Stack>
                {action.undoError ? (
                  <Typography variant="caption" color="error">
                    {action.undoError}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Stack>
        ) : null}
        {message.content ? (
          <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>
            {message.content.replace(/\*\*(.+?)\*\*/g, "$1")}
          </Typography>
        ) : null}
        {message.durationMs != null ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            {(message.durationMs / 1000).toFixed(1)} s
            {message.models?.length ? ` · ${message.models.join(" → ")}` : ""}
          </Typography>
        ) : null}
        {message.error ? (
          <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
            {message.error}
          </Typography>
        ) : null}
      </Paper>
    </Box>
  );
}
