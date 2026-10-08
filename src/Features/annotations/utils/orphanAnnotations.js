// ---------------------------------------------------------------------------
// Orphan annotations — rows whose annotationTemplateId points to a template
// that no longer exists (missing or soft-deleted). They are still rendered
// (the template merge of useAnnotationsV2 keeps the row as-is) but no list
// references them: the « Annot. sans modèle » row (RowOrphanAnnotations)
// counts, solos, hides and selects them.
//
// Solo / eye reuse the template mechanisms (soloAnnotationTemplateId,
// scopeVisibility.hiddenAnnotationTemplateIds) through a sentinel template id,
// distinct from the templateless one (separate eye state).
// ---------------------------------------------------------------------------

export const ORPHAN_TEMPLATE_ID = "__ORPHAN_TEMPLATE__";

export const ORPHAN_LABEL = "Annot. sans modèle";

// An annotation that MAY be orphan: linked to a template (so neither
// templateless nor a base map annotation) and alive.
export function isOrphanCandidate(annotation) {
  return (
    Boolean(annotation?.annotationTemplateId) &&
    !annotation.isTemplateless &&
    !annotation.isBaseMapAnnotation &&
    !annotation.deletedAt
  );
}

// Orphan against a template map (id → template) of the live templates.
export function isOrphanAnnotation(annotation, templateById) {
  return (
    isOrphanCandidate(annotation) &&
    !templateById?.[annotation.annotationTemplateId]
  );
}
