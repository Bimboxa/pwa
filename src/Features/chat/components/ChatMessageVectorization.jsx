import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setVectorization, updateMessageById } from "../chatSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Button,
  CircularProgress,
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
import ChatText from "./ChatText";
import ChatVectorizationCard from "./ChatVectorizationCard";
import { saveVectorizationPointer } from "Features/assistantRelay/utils/vectorizationPointer";

import stringifyFileSize from "Features/files/utils/stringifyFileSize";

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
    `PDF reçu — ${stringifyFileSize(message.pdfByteSize) || "taille inconnue"}`,
    `Analyse par le modèle${run.model ? ` (${run.model})` : ""}`,
    `Résultat vérifié${counts}`,
    run.target?.existingBaseMap
      ? "Recalage sur le fond de plan"
      : "Création du fond de plan",
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
    // `ready` but not confirmed in the card yet: nothing is running.
    if (i === 3 && state === "active" && !message.confirmed) state = "todo";
    return { label, state };
  });
}

// Links to the model's sandbox files mean nothing here; the light markdown
// left (bold, code) is rendered by ChatText.
function cleanModelText(text) {
  return (text ?? "").replace(/\[[^\]]*\]\(sandbox:[^)]*\)/g, "").trim();
}

function StepIcon({ state }) {
  if (state === "done") return <DoneIcon fontSize="small" color="success" />;
  if (state === "failed") return <ErrorIcon fontSize="small" color="error" />;
  if (state === "active")
    return <CircularProgress size={13} thickness={5} color="inherit" />;
  return <TodoIcon fontSize="small" color="disabled" />;
}

// Keep the clock local so long model messages do not render every second.
function VectorizationActivity({ run }) {
  const [now, setNow] = useState(Date.now);
  const analysing = run.status === "queued" || run.status === "analyzing";
  const running = analysing || run.status === "importing";

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, run.runId]);

  const start = Date.parse(run.createdAt);
  const end = running ? now : Date.parse(run.updatedAt);
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const elapsed = Number.isFinite(seconds)
    ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : null;

  if (!analysing && !elapsed) return null;
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ mt: 1, color: "text.secondary" }}
    >
      {analysing ? (
        <Stack direction="row" spacing={0.75} alignItems="center" role="status">
          <CircularProgress
            size={12}
            thickness={5}
            color="inherit"
            aria-hidden="true"
            sx={{
              "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
                "& .MuiCircularProgress-circle": { animation: "none" },
              },
            }}
          />
          <Typography variant="body2">krtographing...</Typography>
        </Stack>
      ) : null}
      {elapsed ? (
        <Typography
          variant="body2"
          component="span"
          role="timer"
          aria-label="Temps écoulé"
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {elapsed}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default function ChatMessageVectorization({ message }) {
  const dispatch = useDispatch();
  const sessionId = useSelector((s) => s.chat.sessionId);
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
          pdfByteSize: message.pdfByteSize,
          target: next.target ?? {},
        };
        saveVectorizationPointer(pointer, sessionId);
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
    <Box sx={{ minWidth: 0 }}>
      <Box>
        <Stack spacing={0.25}>
          {steps.map((step) => (
            <Stack
              key={step.label}
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{ color: "text.secondary", minHeight: 24 }}
            >
              <Box
                sx={{
                  width: 16,
                  display: "flex",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <StepIcon state={step.state} />
              </Box>
              <Typography
                variant="body2"
                color={
                  step.state === "todo"
                    ? "text.disabled"
                    : step.state === "active"
                      ? "text.primary"
                      : "inherit"
                }
              >
                {step.label}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <VectorizationActivity run={run} />

        {message.content ? (
          <ChatText text={cleanModelText(message.content)} sx={{ mt: 1.5 }} />
        ) : null}

        {run.status === "ready" && !message.confirmed ? (
          <ChatVectorizationCard message={message} />
        ) : null}

        {status ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {status}
          </Typography>
        ) : null}
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={0.5} sx={{ mt: 1, ml: "-8px" }}>
          {analysing ? (
            <Button
              size="small"
              color="inherit"
              disabled={busy}
              onClick={() => act(cancelVectorization)}
            >
              Annuler
            </Button>
          ) : null}
          {canResumeImport ? (
            <Button
              size="small"
              color="inherit"
              disabled={busy}
              onClick={() => act(resumeVectorizationImport)}
            >
              {"Relancer l'import"}
            </Button>
          ) : null}
          {canRevalidate ? (
            <Button
              size="small"
              color="inherit"
              disabled={busy}
              onClick={() => act(revalidateVectorization)}
            >
              Revalider le résultat
            </Button>
          ) : null}
          {message.baseMapId ? (
            <Button
              size="small"
              color="inherit"
              onClick={() =>
                dispatch(setSelectedMainBaseMapId(message.baseMapId))
              }
            >
              Ouvrir le fond
            </Button>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
