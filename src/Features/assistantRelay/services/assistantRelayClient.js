import store from "App/store";
import getRelayIdentityHeaders from "../utils/getRelayIdentityHeaders.js";

// HTTP client for the reperage-mcp bridge (/bridge/*). Base URL comes from
// appConfig.features.assistantRelay.relayBaseUrl, the pairing token from the
// slice (mirrored from sessionStorage).

export class AssistantRelayError extends Error {
  constructor(code, status, message) {
    super(message ?? code);
    this.name = "AssistantRelayError";
    this.code = code;
    this.status = status;
  }
}

function getRelayBaseUrl() {
  const url =
    store.getState()?.appConfig?.value?.features?.assistantRelay?.relayBaseUrl;
  if (!url) throw new AssistantRelayError("NOT_CONFIGURED", 0);
  return url.replace(/\/+$/, "");
}

function getToken() {
  const token = store.getState()?.assistantRelay?.token;
  if (!token) throw new AssistantRelayError("NO_TOKEN", 0);
  return token;
}

export async function relayFetch(path, { method = "GET", json } = {}) {
  const baseUrl = getRelayBaseUrl();
  const token = getToken();
  const identityHeaders = getRelayIdentityHeaders(
    store.getState()?.auth?.userProfile
  );
  let response;
  try {
    response = await fetch(`${baseUrl}/bridge${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...identityHeaders,
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch (e) {
    throw new AssistantRelayError("NETWORK", 0, e?.message);
  }
  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    let message = null;
    try {
      const body = await response.json();
      code = body?.error ?? code;
      message = body?.message ?? (body?.issues ? body.issues.join("; ") : null);
    } catch {
      // non-JSON error body
    }
    throw new AssistantRelayError(code, response.status, message);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function fetchRelaySession() {
  return relayFetch("/session");
}

export function publishBaseMapSnapshot(input) {
  return relayFetch("/base-maps", { method: "POST", json: input });
}

export async function fetchProposedJobs() {
  const data = await relayFetch("/jobs?status=proposed&limit=50");
  return data?.jobs ?? [];
}

export async function fetchRecentJobs(limit = 20) {
  const data = await relayFetch(`/jobs?limit=${limit}`);
  return data?.jobs ?? [];
}

export function fetchJob(jobId) {
  return relayFetch(`/jobs/${jobId}`);
}

// status: imported (with an optional `result`, live jobs) | rejected | failed
// (with error).
export function ackJob(jobId, { status, error, result }) {
  return relayFetch(`/jobs/${jobId}/ack`, {
    method: "POST",
    json: {
      status,
      ...(error ? { error } : {}),
      ...(result ? { result } : {}),
    },
  });
}

// Live jobs: take the job for this tab (proposed → applying). 409 when
// another tab was first, 410 when the relay expired it.
export function claimJob(jobId) {
  return relayFetch(`/jobs/${jobId}/claim`, { method: "POST" });
}

// Binary variant (PDF, preview): same auth and error mapping, returns a Blob.
export async function relayFetchBlob(path) {
  const baseUrl = getRelayBaseUrl();
  const token = getToken();
  const identityHeaders = getRelayIdentityHeaders(
    store.getState()?.auth?.userProfile
  );
  let response;
  try {
    response = await fetch(`${baseUrl}/bridge${path}`, {
      headers: { Authorization: `Bearer ${token}`, ...identityHeaders },
    });
  } catch (e) {
    throw new AssistantRelayError("NETWORK", 0, e?.message);
  }
  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    let message = null;
    try {
      const body = await response.json();
      code = body?.error ?? code;
      message = body?.message ?? null;
    } catch {
      // non-JSON error body
    }
    throw new AssistantRelayError(code, response.status, message);
  }
  return response.blob();
}

// ---- base map jobs (fond de plan proposé depuis le composant ChatGPT)

export async function fetchBaseMapJobs(limit = 20) {
  const data = await relayFetch(`/base-map-jobs?limit=${limit}`);
  return data?.jobs ?? [];
}

// Job + `pdf` (summary + downloadPath) + `previewPath`.
export function fetchBaseMapJob(jobId) {
  return relayFetch(`/base-map-jobs/${jobId}`);
}

export function fetchBaseMapJobPdf(job) {
  const path = job?.pdf?.downloadPath?.replace(/^\/bridge/, "");
  if (!path) throw new AssistantRelayError("PDF_NOT_FOUND", 404);
  return relayFetchBlob(path);
}

export function fetchBaseMapJobPreview(jobId) {
  return relayFetchBlob(`/base-map-jobs/${jobId}/preview`);
}

// status: imported (with baseMapId) | rejected | failed (with error).
// Repeating `imported` with the same baseMapId is accepted by the relay.
export function ackBaseMapJob(jobId, { status, baseMapId, error }) {
  return relayFetch(`/base-map-jobs/${jobId}/ack`, {
    method: "POST",
    json: {
      status,
      ...(baseMapId ? { baseMapId } : {}),
      ...(error ? { error } : {}),
    },
  });
}

// ---- chat turns (commandes en langage naturel : « dessine un rond de 1 m »)

// One conversational turn, streamed. Events: { type: "text", delta },
// { type: "tool", phase, callId, name, jobId?, liveStatus? },
// { type: "need_image", snapshotId }, { type: "done", responseId,
// imageAttached, models, durationMs }, { type: "error", message }. Resolves when the
// relay closes the stream.
export async function streamChatTurn(input, { signal, onEvent } = {}) {
  const baseUrl = getRelayBaseUrl();
  const token = getToken();
  const identityHeaders = getRelayIdentityHeaders(
    store.getState()?.auth?.userProfile
  );
  let response;
  try {
    response = await fetch(`${baseUrl}/bridge/chat/turns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...identityHeaders,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(input),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) return;
    throw new AssistantRelayError("NETWORK", 0, e?.message);
  }
  if (!response.ok) throw await toRelayError(response);
  await readEventStream(response, { signal, onEvent });
}

// Picture of a snapshot the relay only knows the context of: sent when a
// chat turn says `need_image`. `image` = { mime, width, height, base64 }.
export function uploadSnapshotImage(snapshotId, image) {
  return relayFetch(`/snapshots/${snapshotId}/image`, {
    method: "POST",
    json: image,
  });
}

// Undo button of a drawing made from the chat (no model involved): the relay
// creates the `live_undo` job, the runtime applies it.
export function undoLiveJob(jobId) {
  return relayFetch(`/jobs/${jobId}/undo`, { method: "POST" });
}

// ---- vectorization runs (PDF déposé dans le Chat, analysé depuis le relai)

// Raw PDF body (no JSON, no multipart). Returns { pdfId, pageCount, pages }.
export async function uploadRelayPdf(file) {
  const baseUrl = getRelayBaseUrl();
  const token = getToken();
  const identityHeaders = getRelayIdentityHeaders(
    store.getState()?.auth?.userProfile
  );
  const name = encodeURIComponent(file?.name || "document.pdf");
  let response;
  try {
    response = await fetch(`${baseUrl}/bridge/pdfs?fileName=${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...identityHeaders,
        "Content-Type": "application/pdf",
      },
      body: file,
    });
  } catch (e) {
    throw new AssistantRelayError("NETWORK", 0, e?.message);
  }
  if (!response.ok) throw await toRelayError(response);
  return response.json();
}

// Levels of reflection offered in the chat: [{ id: "high"|"medium"|"low",
// label, model, reasoningEffort, isDefault }]. The relay maps each level to a
// model from what the provider's account offers.
export async function fetchReasoningLevels() {
  const data = await relayFetch("/reasoning-levels");
  return data?.levels ?? [];
}

// { pdfId, pageNumber, instruction, target, level?, clientRequestId } → run. The same
// clientRequestId returns the same run (no second analysis).
export function createVectorization(input) {
  return relayFetch("/vectorizations", { method: "POST", json: input });
}

export function fetchVectorization(runId) {
  return relayFetch(`/vectorizations/${runId}`);
}

export function cancelVectorization(runId) {
  return relayFetch(`/vectorizations/${runId}/cancel`, { method: "POST" });
}

// Result card: what would be imported, normalized on the whole page
// ({ image, annotationTemplates, annotations }).
export function fetchVectorizationPreview(runId) {
  return relayFetch(`/vectorizations/${runId}/preview`);
}

// The user's decision on the card. `confirm` only records the templates left
// out: the PWA then creates the base map from the run's base map job.
export function confirmVectorization(runId, { excludedTemplateIds = [] } = {}) {
  return relayFetch(`/vectorizations/${runId}/confirm`, {
    method: "POST",
    json: { excludedTemplateIds },
  });
}

export function dismissVectorization(runId) {
  return relayFetch(`/vectorizations/${runId}/dismiss`, { method: "POST" });
}

export function fetchRelayPdf(pdfId) {
  return relayFetchBlob(`/pdfs/${pdfId}`);
}

// A run refused at validation is checked again by the relay (stored result,
// current rules). Never re-runs the model.
export function revalidateVectorization(runId) {
  return relayFetch(`/vectorizations/${runId}/revalidate`, { method: "POST" });
}

// Rebuilds an annotations job that expired / failed. Never re-runs the model.
export function resumeVectorizationImport(runId) {
  return relayFetch(`/vectorizations/${runId}/resume-import`, {
    method: "POST",
  });
}

// Server-sent events over fetch (EventSource cannot send the Bearer token).
// Resolves when the relay closes the stream (run finished) or on abort;
// rejects on a network / HTTP error so the caller can reconnect with the
// last id it saw.
export async function streamVectorizationEvents(
  runId,
  { after = 0, signal, onEvent } = {}
) {
  const baseUrl = getRelayBaseUrl();
  const token = getToken();
  const identityHeaders = getRelayIdentityHeaders(
    store.getState()?.auth?.userProfile
  );
  let response;
  try {
    response = await fetch(
      `${baseUrl}/bridge/vectorizations/${runId}/events?after=${after}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...identityHeaders,
          Accept: "text/event-stream",
        },
        signal,
      }
    );
  } catch (e) {
    if (signal?.aborted) return;
    throw new AssistantRelayError("NETWORK", 0, e?.message);
  }
  if (!response.ok) throw await toRelayError(response);

  await readEventStream(response, { signal, onEvent });
}

// Minimal SSE parser over fetch: one JSON `data:` line per block, comments
// (heartbeats) ignored.
async function readEventStream(response, { signal, onEvent }) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        const data = block
          .split("\n")
          .filter((l) => l.startsWith("data: "))
          .map((l) => l.slice(6))
          .join("\n");
        if (!data) continue; // heartbeat comment
        try {
          onEvent?.(JSON.parse(data));
        } catch (e) {
          console.log("[assistantRelay] bad SSE block", e);
        }
      }
    }
  } catch (e) {
    if (signal?.aborted) return;
    throw new AssistantRelayError("NETWORK", 0, e?.message);
  }
}

async function toRelayError(response) {
  let code = `HTTP_${response.status}`;
  let message = null;
  try {
    const body = await response.json();
    code = body?.error ?? code;
    message = body?.message ?? (body?.issues ? body.issues.join("; ") : null);
  } catch {
    // non-JSON error body
  }
  return new AssistantRelayError(code, response.status, message);
}

// Short French messages for the panel.
export function describeRelayError(e) {
  const code = e?.code ?? "UNKNOWN";
  const messages = {
    NOT_CONFIGURED: "Relai non configuré (appConfig.features.assistantRelay).",
    NO_TOKEN: "Saisissez le token d'appairage.",
    NETWORK: "Relai injoignable (réseau ou CORS).",
    UNAUTHORIZED: "Token refusé par le relai.",
    ORIGIN_NOT_ALLOWED: "Origine de la PWA non autorisée par le relai.",
    HOST_NOT_ALLOWED: "Hôte non autorisé par le relai.",
    NO_BASE_MAP_PUBLISHED: "Aucun fond de plan publié.",
    ASPECT_RATIO_MISMATCH: "L'image publiée ne respecte pas le ratio du fond.",
    IMAGE_TOO_LARGE: "Image trop volumineuse pour le relai.",
    JOB_NOT_FOUND: "Proposition introuvable sur le relai.",
    JOB_ALREADY_RESOLVED: "Proposition déjà traitée.",
    UPSTREAM_FAILED: "Erreur Supabase côté relai.",
    PDF_NOT_FOUND: "PDF introuvable sur le relai.",
    PREVIEW_NOT_FOUND: "Aperçu indisponible.",
    SNAPSHOT_NOT_FOUND: "Fond de plan publié introuvable sur le relai.",
    JOB_EXPIRED: "Commande expirée sur le relai.",
    TARGET_NOT_CALIBRATED:
      "Le fond de plan affiché n'a pas d'échelle : calibrez-le d'abord.",
    NO_LISTING: "Aucune liste d'annotations pour recevoir le dessin.",
    LISTING_NOT_FOUND: "Liste cible introuvable dans le projet courant.",
    NO_SCOPE: "Aucun scope sélectionné pour créer la liste.",
    LISTING_NOT_CREATED: "La liste n'a pas pu être créée.",
    NO_BASE_MAP: "Aucun fond de plan affiché.",
    CHAT_DISABLED:
      "L'assistant n'est pas activé sur le relai (clé API absente).",
    NOT_UNDOABLE: "Ce dessin ne peut pas être annulé (pas encore appliqué ?).",
    ALREADY_UNDONE: "Ce dessin est déjà annulé.",
    VECTORIZATION_DISABLED:
      "La vectorisation n'est pas activée sur le relai (clé API absente).",
    UNKNOWN_MODEL: "Modèle non proposé par le relai.",
    RUN_ALREADY_ACTIVE: "Une vectorisation est déjà en cours.",
    RUN_NOT_REVALIDABLE: "Ce traitement n'est pas en échec de validation.",
    RESULT_EXPIRED:
      "Le résultat du modèle n'est plus disponible (bac à sable expiré) : relancez l'analyse.",
    RUN_NOT_FOUND: "Vectorisation introuvable sur le relai.",
    RUN_NOT_READY: "Le fond de plan n'a pas encore été créé et publié.",
    PAYLOAD_TOO_LARGE: "Fichier trop volumineux pour le relai.",
  };
  const base = messages[code] ?? `Erreur relai (${code}).`;
  return e?.message && e.message !== code ? `${base} ${e.message}` : base;
}
