export const CHAT_PROGRESS_LABELS = {
  preparing: "Préparation de la demande…",
  preparing_pdf: "Préparation du PDF source…",
  uploading_pdf: "Envoi du PDF au serveur…",
  connecting: "Connexion au serveur…",
  pdf_ready: "PDF prêt côté serveur…",
  image_fallback: "Préparation du fond sous forme d’image…",
  preparing_image: "Préparation de l’image du fond…",
  uploading_image: "Envoi de l’image au serveur…",
  image_ready: "Image prête côté serveur…",
  preparing_request: "Préparation de la requête LLM…",
  sending: "Envoi de la requête au LLM…",
  analyzing: "krtographing...",
  tools: "Application des actions sur le plan…",
  answering: "Rédaction de la réponse…",
};

export function updateChatProgress(progress, event) {
  // The relay can start analysis before the upload acknowledgement reaches us.
  if (
    event.stage === "image_ready" &&
    progress.planStatus === "Image disponible pour le LLM"
  )
    return progress;
  const next = {
    ...progress,
    stage: event.stage,
    ...(event.model ? { model: event.model } : {}),
  };
  if (event.stage === "pdf_ready") next.planStatus = "PDF prêt côté serveur";
  if (event.stage === "image_fallback")
    next.planStatus = "Source utilisée : image du fond";
  if (event.stage === "image_ready")
    next.planStatus = "Image prête côté serveur";
  if (event.stage === "analyzing" && event.source)
    next.planStatus =
      event.source === "pdf"
        ? "PDF disponible pour le LLM"
        : "Image disponible pour le LLM";
  return next;
}

export function formatChatElapsed(startedAt, now) {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
