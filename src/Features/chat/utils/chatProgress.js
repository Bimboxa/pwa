export const CHAT_TOOL_LABELS = {
  summarize_plan_vectors: "Synthèse des familles vectorielles",
  prepare_visible_geometry: "Reconstruction des contours masqués",
  analyze_linear_sections: "Analyse des axes et épaisseurs",
  validate_section_candidates: "Validation des sections",
  analyze_rectangular_sections: "Analyse des sections rectangulaires",
  code_interpreter: "Analyse Python distante",
  render_plan_region: "Rendu du plan",
  query_plan_geometry: "Recherche géométrique",
  measure_plan_geometry: "Mesures géométriques",
  check_plan_geometry: "Vérification géométrique",
  draw_annotations: "Dessin",
  query_annotations: "Sélection des annotations",
  update_annotations_batch: "Modification des annotations",
  create_annotation_templates: "Création de modèles d'annotation",
  create_annotation_listing: "Création d'une liste",
  undo_drawing: "Annulation des modifications",
  get_current_base_map: "Lecture du fond de plan",
  get_detection_instructions: "Lecture des consignes",
  get_detection_job: "Vérification d'un dessin",
  request_plan_image: "Lecture du plan (image)",
};

export const CHAT_PROGRESS_LABELS = {
  preparing: "Préparation de la demande…",
  reading_pdf_vectors: "Extraction des tracés vectoriels du PDF…",
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
  analyzing: "Analyse de la demande…",
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
    toolName: event.stage === "tools" ? (event.toolName ?? null) : null,
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

export function getChatProgressLabel(progress) {
  const toolLabel =
    progress?.stage === "tools" && CHAT_TOOL_LABELS[progress.toolName];
  return toolLabel
    ? `${toolLabel}…`
    : (CHAT_PROGRESS_LABELS[progress?.stage] ?? CHAT_PROGRESS_LABELS.analyzing);
}
