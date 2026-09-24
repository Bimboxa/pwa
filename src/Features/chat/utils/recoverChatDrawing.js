export function drawingLiveStatus(status) {
  if (status === "imported") return "applied";
  if (status === "failed") return "failed";
  if (["rejected", "expired", "discarded"].includes(status)) return "discarded";
  return "pending";
}

// Use only jobs linked to this message, never unrelated recent detections.
export async function recoverMessageDrawings(actions, dependencies) {
  const results = [];
  const jobs = new Map();
  for (const action of actions ?? []) {
    if (action.name !== "draw_annotations" || !action.jobId || action.undone)
      continue;
    let result = jobs.get(action.jobId);
    if (!result) {
      try {
        result = await recoverChatDrawing(action.jobId, dependencies);
      } catch (error) {
        result = { failure: error };
      }
      jobs.set(action.jobId, result);
    }
    results.push({ action, ...result });
  }
  return results;
}

// Retrieve the original job; never create another drawing or rerun inference.
export async function recoverChatDrawing(jobId, { fetchJob, applyLiveJob }) {
  let job = await fetchJob(jobId);
  if (job.mode !== "live" || job.payload?.annotationBatch) {
    throw new Error("Cette tâche ne contient pas un dessin récupérable.");
  }
  if (
    job.status === "proposed" ||
    (job.status === "rejected" && job.error === "expired")
  ) {
    if (!job.payload?.annotations?.length) {
      throw new Error("Aucune annotation à récupérer dans cette tâche.");
    }
    await applyLiveJob(job, { manual: true });
    job = await fetchJob(jobId);
  }
  const liveStatus = drawingLiveStatus(job.status);
  const error =
    liveStatus === "applied"
      ? null
      : job.status === "applying"
        ? "L’application de ce dessin est déjà en cours ou son accusé de réception est en attente. Réessayez pour vérifier son état."
        : liveStatus === "failed"
          ? job.error || "L’application des annotations a échoué."
          : liveStatus === "discarded"
            ? "Ce dessin a expiré ou a été abandonné ; il ne peut plus être appliqué."
            : "Le dessin n’a pas encore été appliqué. Vérifiez que le module plan est ouvert dans le projet concerné, puis réessayez.";
  return { job, liveStatus, error };
}
