import { useState } from "react";
import { useDispatch } from "react-redux";

import { setVectorization, updateMessageById } from "../chatSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

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
  RadioButtonUnchecked as TodoIcon,
} from "@mui/icons-material";

import {
  cancelVectorization,
  describeRelayError,
  resumeVectorizationImport,
  revalidateVectorization,
} from "Features/assistantRelay/services/assistantRelayClient";
import { saveVectorizationPointer } from "Features/assistantRelay/utils/vectorizationPointer";

const ORDER = ["queued", "analyzing", "ready", "importing", "completed"];
const FAILED_AT = {
  analysis: 1,
  validation: 2,
  base_map: 3,
  annotations: 4,
};

// Steps as observed on the run (no invented percentage): each one is done,
// active, failed or to do.
function buildSteps(message) {
  const run = message.run ?? {};
  const rank = ORDER.indexOf(run.status);
  const failedAt =
    run.status === "failed" ? (FAILED_AT[run.failedStep] ?? 1) : null;
  const localFailed =
    message.localStep === "base_map_error" ||
    message.localStep === "publish_error";
  const counts =
    run.annotationCount != null
      ? ` (${run.annotationCount} annotations, ${run.templateCount ?? 0} modèles)`
      : "";
  const labels = [
    "PDF reçu",
    `Analyse par le modèle${run.model ? ` (${run.model})` : ""}`,
    `Résultat vérifié${counts}`,
    "Création du fond de plan",
    "Import des annotations",
  ];
  // Index of the step being worked on, from the run status.
  const active = { queued: 1, analyzing: 1, ready: 3, importing: 4 }[
    run.status
  ];
  return labels.map((label, i) => {
    let state = "todo";
    if (run.status === "completed") state = "done";
    else if (run.status === "cancelled") state = i === 0 ? "done" : "todo";
    else if (failedAt !== null)
      state = i < failedAt ? "done" : i === failedAt ? "failed" : "todo";
    else if (rank >= 0 && active !== undefined)
      state = i < active ? "done" : i === active ? "active" : "todo";
    if (i === 3 && state === "active" && localFailed) state = "failed";
    return { label, state };
  });
}

// The model writes light markdown; the bubble is plain text.
function cleanModelText(text) {
  return (text ?? "")
    .replace(/\[[^\]]*\]\(sandbox:[^)]*\)/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
}

function StepIcon({ state }) {
  if (state === "done") return <DoneIcon fontSize="small" color="success" />;
  if (state === "failed") return <ErrorIcon fontSize="small" color="error" />;
  if (state === "active") return <CircularProgress size={16} />;
  return <TodoIcon fontSize="small" color="disabled" />;
}

export default function ChatMessageVectorization({ message }) {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);

  const run = message.run ?? {};
  const steps = buildSteps(message);
  const analysing = run.status === "queued" || run.status === "analyzing";
  const canResumeImport =
    run.status === "importing" ||
    (run.status === "failed" && run.failedStep === "annotations");

  const canRevalidate =
    run.status === "failed" && run.failedStep === "validation";

  const act = async (fn) => {
    setBusy(true);
    try {
      const next = await fn(run.runId);
      // A run brought back to life (revalidated, import resumed) is followed
      // again by the runtime: progress stream + base map creation.
      if (!["completed", "failed", "cancelled"].includes(next?.status)) {
        const pointer = {
          runId: next.runId,
          messageId: message.id,
          target: next.target ?? {},
        };
        saveVectorizationPointer(pointer);
        dispatch(setVectorization(pointer));
      }
      dispatch(
        updateMessageById({
          id: message.id,
          changes: { run: next, localError: null },
        })
      );
    } catch (e) {
      dispatch(
        updateMessageById({
          id: message.id,
          changes: { localError: e?.code ? describeRelayError(e) : e?.message },
        })
      );
    } finally {
      setBusy(false);
    }
  };

  const status =
    run.status === "completed"
      ? "Terminé."
      : run.status === "cancelled"
        ? "Analyse annulée."
        : message.localStep === "wrong_project"
          ? "Revenez dans le projet d'origine pour terminer l'import."
          : message.toolRunning
            ? "Le modèle exécute du code sur le PDF…"
            : null;
  const error =
    (run.status === "failed" ? run.error : null) ??
    message.localError ??
    message.streamError;

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
        <Stack spacing={0.5}>
          {steps.map((step) => (
            <Stack
              key={step.label}
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <StepIcon state={step.state} />
              <Typography
                variant="body2"
                color={step.state === "todo" ? "text.disabled" : "text.primary"}
              >
                {step.label}
              </Typography>
            </Stack>
          ))}
        </Stack>

        {message.content ? (
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-line", mt: 1.5, color: "text.secondary" }}
          >
            {cleanModelText(message.content)}
          </Typography>
        ) : null}

        {status ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {status}
          </Typography>
        ) : null}
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          {analysing ? (
            <Button
              size="small"
              disabled={busy}
              onClick={() => act(cancelVectorization)}
            >
              Annuler
            </Button>
          ) : null}
          {canResumeImport ? (
            <Button
              size="small"
              disabled={busy}
              onClick={() => act(resumeVectorizationImport)}
            >
              {"Relancer l'import"}
            </Button>
          ) : null}
          {canRevalidate ? (
            <Button
              size="small"
              disabled={busy}
              onClick={() => act(revalidateVectorization)}
            >
              Revalider le résultat
            </Button>
          ) : null}
          {message.baseMapId ? (
            <Button
              size="small"
              onClick={() =>
                dispatch(setSelectedMainBaseMapId(message.baseMapId))
              }
            >
              Ouvrir le fond
            </Button>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}
