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

// Store observable lifecycle metadata, interpreter code and the exact drawing
// arguments captured by the relay (`detection_debug` raw_detection, i.e.
// draw_annotations / create_annotation_templates), never other tool arguments
// or raw prompts.
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
    ) &&
    !(
      event.type === "detection_debug" &&
      event.artifact?.stage === "raw_detection" &&
      event.artifact.callId &&
      typeof event.artifact.data?.argumentsJson === "string"
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
      // The relay names the model that answered: the `sending` progress event
      // arrives after the first (unconfirmed) tokens event, and the model can
      // change during a turn.
      if (event.usage.model) entry.model = event.usage.model;
      // Provider-confirmed counters: cache share is what compares two runs.
      entry.usage = pickUsage(event.usage);
    }
  } else if (event.type === "detection_debug") {
    // Arrives before the tool's `started` event: reserve its step now.
    const id = `tool-${event.artifact.callId}`;
    let entry = next.entries.find((item) => item.id === id);
    if (!entry) {
      const name = event.artifact.data.tool ?? "draw_annotations";
      entry = {
        id,
        kind: "tool",
        stepNumber: allocate(),
        name,
        title: CHAT_TOOL_LABELS[name] ?? name,
        startedAt: now,
        status: "running",
      };
      next.entries.push(entry);
    }
    entry.argumentsJson = event.artifact.data.argumentsJson;
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
    } else if (event.phase === "started" && entry.startedAt == null)
      entry.startedAt = now;
    if (event.name === "code_interpreter" && typeof event.code === "string")
      entry.code = event.code;
    if (event.summary) entry.summary = short(event.summary);
    if (event.detail) entry.detail = String(event.detail).slice(-4000);
    if (event.phase === "failed" && !entry.detail)
      entry.detail = "Aucun détail d’erreur fourni par le serveur.";
    if (event.phase !== "started") {
      entry.status = ["failed", "interrupted"].includes(event.phase)
        ? event.phase
        : "done";
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
    if (event.type === "done" && event.usage) {
      next.usage = pickUsage(event.usage);
      next.cost = event.cost ?? null;
      next.steps = Number.isInteger(event.steps) ? event.steps : null;
    }
  }
  if (next.entries.length > MAX_STEPS) {
    next.omitted += next.entries.length - MAX_STEPS;
    next.entries = next.entries.slice(-MAX_STEPS);
  }
  return next;
}

const count = (value) => (Number.isFinite(value) ? value : null);
function pickUsage(usage) {
  return {
    inputTokens: count(usage?.inputTokens),
    cachedTokens: count(usage?.cachedTokens),
    cacheWriteTokens: count(usage?.cacheWriteTokens),
    outputTokens: count(usage?.outputTokens),
    reasoningTokens: count(usage?.reasoningTokens),
    model: usage?.model ?? null,
    // Micro-euros priced by the relay for this call (null: unknown rate).
    costMicros: count(usage?.costMicros),
  };
}

const tokens = (value) => new Intl.NumberFormat("fr-FR").format(value);
const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

// 12345 micro-euros → "0,012 €"
export function formatMicros(micros) {
  return Number.isFinite(micros) ? euros.format(micros / 1e6) : "";
}

// { micros, complete } → "0,42 €" or "≥ 0,42 € (tarif inconnu pour une partie)"
export function formatCost(cost) {
  if (!cost || !Number.isFinite(cost.micros)) return "Coût indisponible";
  const amount = formatMicros(cost.micros);
  return cost.complete === false
    ? `≥ ${amount} (tarif inconnu pour une partie)`
    : amount;
}

// "Entrée 12 300 tokens (9 800 en cache) · Sortie 1 200 (450 raisonnement) · 0,012 €"
export function formatTokenUsage(usage) {
  if (!usage || usage.inputTokens == null) return "";
  const cache = [
    usage.cachedTokens != null ? `${tokens(usage.cachedTokens)} en cache` : "",
    usage.cacheWriteTokens ? `${tokens(usage.cacheWriteTokens)} écrits` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const input = `Entrée ${tokens(usage.inputTokens)} tokens${
    cache ? ` (${cache})` : ""
  }`;
  const output =
    usage.outputTokens != null
      ? ` · Sortie ${tokens(usage.outputTokens)}${
          usage.reasoningTokens
            ? ` (${tokens(usage.reasoningTokens)} raisonnement)`
            : ""
        }`
      : "";
  const cost =
    usage.costMicros != null ? ` · ${formatMicros(usage.costMicros)}` : "";
  return input + output + cost;
}

// Session accumulator (chatSlice.conversation.usage) → one line.
export function formatSessionUsage(usage) {
  if (!usage || !usage.turns) return "";
  return (
    `${usage.turns} tour(s) · ${usage.calls} appel(s) au modèle · ` +
    `Entrée ${tokens(usage.inputTokens)} tokens (${tokens(usage.cachedTokens)} en cache) · ` +
    `Sortie ${tokens(usage.outputTokens)} · Coût cumulé ${formatCost({
      micros: usage.costMicros,
      complete: usage.costComplete,
    })}`
  );
}

export function formatStepDuration(entry, now) {
  if (entry.startedAt == null) return "Durée indisponible";
  const ms = Math.max(0, (entry.endedAt ?? now) - entry.startedAt);
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

// Exact provider arguments: parsed when valid, kept verbatim otherwise.
function parseArguments(json) {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
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
        ...(typeof entry.argumentsJson === "string"
          ? { arguments: parseArguments(entry.argumentsJson) }
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
