// Bounded, tab-local history. Never store credentials, payloads or raw errors.
export function createDrawingDiagnostics() {
  const jobs = new Map();
  const connection = [];
  function append(events, event, limit) {
    const previous =
      event.phase === "job_observed" || event.phase.startsWith("skipped_")
        ? events.findLast((entry) => entry.phase === event.phase)
        : events.at(-1);
    if (
      previous &&
      JSON.stringify(previous.details) === JSON.stringify(event.details) &&
      previous.phase === event.phase
    )
      return;
    events.push({ at: new Date().toISOString(), ...event });
    if (events.length > limit) events.shift();
  }
  return {
    record(jobId, phase, details = {}) {
      if (!jobId) return;
      if (!jobs.has(jobId)) {
        jobs.set(jobId, []);
        if (jobs.size > 100) jobs.delete(jobs.keys().next().value);
      }
      // Explicit allowlist: callers cannot accidentally export payloads/tokens.
      const safe = {};
      for (const key of [
        "status",
        "code",
        "httpStatus",
        "manual",
        "visibility",
        "online",
      ])
        if (details[key] !== undefined) safe[key] = details[key];
      append(jobs.get(jobId), { phase, details: safe }, 40);
    },
    connection(details) {
      append(
        connection,
        {
          phase: "connection",
          details: {
            status: details.status ?? null,
            transport: details.transport ?? null,
            realtime: details.realtime ?? null,
            code: details.code ?? null,
            visibility: details.visibility ?? null,
            online: details.online ?? null,
          },
        },
        100
      );
    },
    read(jobId) {
      return JSON.parse(
        JSON.stringify({
          attempts: jobs.get(jobId) ?? [],
          connection,
          retention:
            "Current tab since page load; up to 100 jobs, 40 events per job and 100 connection events.",
        })
      );
    },
  };
}

export const drawingDiagnostics = createDrawingDiagnostics();

function jobSummary(job) {
  if (!job) return null;
  return {
    jobId: job.jobId,
    status: job.status,
    mode: job.mode,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    snapshotId: job.snapshotId,
    expired: job.error === "expired",
    annotationCount: job.annotationCount ?? job.payload?.annotations?.length,
    templateCount:
      job.templateCount ?? job.payload?.annotationTemplates?.length,
    baseMapId: job.snapshot?.baseMapId ?? null,
    listingId: job.listing?.id ?? job.snapshot?.listingId ?? null,
    placement: job.placement?.mode ?? null,
  };
}

export function buildDrawingDiagnostic({
  jobId,
  state,
  serverJob,
  fetchError,
  history,
  environment,
  capturedAt = new Date().toISOString(),
}) {
  const relay = state.assistantRelay ?? {};
  const localJob = relay.jobsById?.[jobId];
  const createdAt = serverJob?.createdAt ?? localJob?.createdAt;
  const elapsed = Date.parse(capturedAt) - Date.parse(createdAt);
  return {
    version: 1,
    kind: "drawing-delivery",
    capturedAt,
    jobId,
    ageMs: Number.isFinite(elapsed) ? Math.max(0, elapsed) : null,
    localJob: jobSummary(localJob),
    serverJob: jobSummary(serverJob),
    serverRead: fetchError
      ? {
          ok: false,
          code: fetchError.code ?? "READ_FAILED",
          httpStatus: fetchError.status ?? null,
        }
      : { ok: true },
    connection: {
      status: relay.connectionStatus,
      code: relay.connectionErrorCode,
      transport: relay.realtimeTransport,
      realtime: relay.realtimeStatus,
      // Credential values and the session key must never be serialized.
      mode:
        state.appConfig?.chatConnection?.mode ??
        state.appConfig?.value?.features?.chat?.connection?.mode ??
        "PWA_KEY",
    },
    currentContext: {
      projectId: state.projects?.selectedProjectId ?? null,
      scopeId: state.scopes?.selectedScopeId ?? null,
      baseMapId: state.mapEditor?.selectedBaseMapId ?? null,
      listingId: state.listings?.selectedListingId ?? null,
      publishedBaseMapId: relay.currentSnapshot?.baseMapId ?? null,
      snapshotId: relay.currentSnapshot?.snapshotId ?? null,
    },
    environment: {
      visibility: environment.visibility,
      online: environment.online,
    },
    history,
  };
}
