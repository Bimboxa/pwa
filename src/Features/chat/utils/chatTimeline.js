import { CHAT_PROGRESS_LABELS, CHAT_TOOL_LABELS } from "./chatProgress.js";

const MAX_STEPS = 200;
const PREPARATION = new Set([
  "preparing",
  "preparing_pdf",
  "uploading_pdf",
  "connecting",
  "reading_pdf_vectors",
  "preparing_image",
  "uploading_image",
  "preparing_request",
]);
const short = (text) =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);

// Store observable lifecycle metadata and interpreter code, never tool arguments or raw prompts.
export function updateChatTimeline(
  previous,
  event,
  now = Date.now(),
  request = ""
) {
  const state = previous ?? {
    entries: [],
    omitted: 0,
    nextStepNumber: 1,
    pendingTools: [],
    model: null,
  };
  const existing =
    event.type === "tokens"
      ? state.entries.findLast(
          (entry) =>
            entry.kind === "model" &&
            (event.usage?.traceCode
              ? entry.traceCode === event.usage.traceCode
              : entry.step === event.usage?.step)
        )
      : null;
  if (existing && !event.usage.confirmed) return state;
  if (
    !["progress", "tokens", "tool", "error", "trace_end", "done"].includes(
      event.type
    )
  )
    return state;
  const next = {
    ...state,
    entries: state.entries.map((entry) => ({ ...entry })),
    pendingTools: [...state.pendingTools],
  };
  const allocate = () => {
    const number =
      event.stepNumber ??
      next.nextStepNumber ??
      (next.omitted ?? 0) + next.entries.length + 1;
    next.nextStepNumber = Math.max(next.nextStepNumber ?? 1, number + 1);
    return number;
  };
  const endPreparation = () => {
    for (const entry of next.entries)
      if (entry.kind === "preparation" && entry.status === "running") {
        entry.status = "done";
        entry.endedAt = now;
      }
  };
  if (event.type === "progress") {
    if (event.model) next.model = event.model;
    if (PREPARATION.has(event.stage)) {
      if (
        next.entries.at(-1)?.stage === event.stage &&
        next.entries.at(-1)?.status === "running"
      )
        return state;
      endPreparation();
      next.entries.push({
        id: `stage-${now}-${next.entries.length}`,
        kind: "preparation",
        stepNumber: allocate(),
        stage: event.stage,
        title: CHAT_PROGRESS_LABELS[event.stage],
        status: "running",
        startedAt: now,
      });
    } else endPreparation();
  } else if (event.type === "tokens" && Number.isInteger(event.usage?.step)) {
    endPreparation();
    let entry = next.entries.findLast(
      (item) =>
        item.kind === "model" &&
        (event.usage.traceCode
          ? item.traceCode === event.usage.traceCode
          : item.step === event.usage.step)
    );
    if (!entry) {
      const tools = [...new Set(next.pendingTools)];
      entry = {
        id: `model-${event.usage.traceCode ?? event.usage.step}`,
        ...(event.usage.traceCode ? { traceCode: event.usage.traceCode } : {}),
        kind: "model",
        stepNumber: allocate(),
        step: event.usage.step,
        title: event.usage.traceCode
          ? `${event.usage.traceCode} · Appel au modèle`
          : `Appel ${event.usage.step} au modèle`,
        model: next.model,
        summary: tools.length
          ? `Analyse des résultats : ${tools.join(", ")}.`
          : event.usage.step === 1
            ? `Demande : ${short(request) || "Analyser la demande et le contexte disponibles."}`
            : "Poursuite de la demande à partir du contexte disponible.",
        status: "running",
        startedAt: now,
      };
      next.entries.push(entry);
      next.pendingTools = [];
    }
    if (event.usage.confirmed) {
      entry.status = "done";
      entry.endedAt = now;
    }
  } else if (event.type === "tool") {
    endPreparation();
    let entry = next.entries.find((item) => item.id === `tool-${event.callId}`);
    if (!entry) {
      entry = {
        id: `tool-${event.callId}`,
        kind: "tool",
        stepNumber: allocate(),
        name: event.name,
        title: CHAT_TOOL_LABELS[event.name] ?? event.name,
        startedAt: event.phase === "started" ? now : null,
        status: "running",
      };
      next.entries.push(entry);
    }
    if (event.name === "code_interpreter" && typeof event.code === "string")
      entry.code = event.code;
    if (event.summary) entry.summary = short(event.summary);
    if (event.detail) entry.detail = String(event.detail).slice(-4000);
    if (event.phase === "failed" && !entry.detail)
      entry.detail = "Aucun détail d’erreur fourni par le serveur.";
    if (event.phase !== "started") {
      entry.status = event.phase === "failed" ? "failed" : "done";
      entry.endedAt = now;
      const label = CHAT_TOOL_LABELS[event.name] ?? event.name;
      if (!next.pendingTools.includes(label)) next.pendingTools.push(label);
    }
  } else if (["error", "trace_end", "done"].includes(event.type)) {
    const status =
      event.type === "error"
        ? "failed"
        : event.type === "done"
          ? "done"
          : "interrupted";
    for (const entry of next.entries)
      if (entry.status === "running") {
        entry.status = status;
        entry.endedAt = now;
      }
    // A provider may report usage before reporting an incomplete/failed response.
    if (event.type === "error" && next.entries.at(-1)?.kind === "model")
      next.entries.at(-1).status = "failed";
  }
  if (next.entries.length > MAX_STEPS) {
    next.omitted += next.entries.length - MAX_STEPS;
    next.entries = next.entries.slice(-MAX_STEPS);
  }
  return next;
}

export function formatStepDuration(entry, now) {
  if (entry.startedAt == null) return "Durée indisponible";
  const ms = Math.max(0, (entry.endedAt ?? now) - entry.startedAt);
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function serializeChatTimeline(timeline) {
  return JSON.stringify(
    {
      version: 2,
      omitted: timeline?.omitted ?? 0,
      steps: (timeline?.entries ?? []).map((entry, index) => ({
        ...entry,
        ...(entry.name === "code_interpreter"
          ? { code: entry.code ?? null }
          : {}),
        stepNumber: entry.stepNumber ?? (timeline?.omitted ?? 0) + index + 1,
        durationMs:
          entry.startedAt != null && entry.endedAt != null
            ? Math.max(0, entry.endedAt - entry.startedAt)
            : null,
      })),
    },
    null,
    2
  );
}
