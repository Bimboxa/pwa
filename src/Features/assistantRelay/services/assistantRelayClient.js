import store from "App/store";

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
  let response;
  try {
    response = await fetch(`${baseUrl}/bridge${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
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
  let response;
  try {
    response = await fetch(`${baseUrl}/bridge${path}`, {
      headers: { Authorization: `Bearer ${token}` },
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
  };
  const base = messages[code] ?? `Erreur relai (${code}).`;
  return e?.message && e.message !== code ? `${base} ${e.message}` : base;
}
