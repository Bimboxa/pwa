// ---------------------------------------------------------------------------
// Templateless annotations — drawn from the "Dessin" tool (hotkey D): no
// annotation template, no listing. They belong to a base map + a scope only
// (`baseMapId` + `scopeId`) and carry their own style.
//
// Solo / eye reuse the template mechanisms (soloAnnotationTemplateId,
// scopeVisibility.hiddenAnnotationTemplateIds) through a sentinel template id.
// ---------------------------------------------------------------------------

export const TEMPLATELESS_TEMPLATE_ID = "__TEMPLATELESS__";

export const TEMPLATELESS_LABEL = "Sans modèle";

export const DEFAULT_TEMPLATELESS_DRAWING_SHAPE = "POLYGON";

export function isTemplatelessAnnotation(annotation) {
  return Boolean(annotation?.isTemplateless);
}

// Template id used by the solo / hidden filters: the sentinel for templateless
// annotations.
export function getAnnotationTemplateKey(annotation) {
  return (
    annotation?.annotationTemplateId ??
    (isTemplatelessAnnotation(annotation)
      ? TEMPLATELESS_TEMPLATE_ID
      : undefined)
  );
}

// Templateless annotations of a scope, among rows read straight from Dexie.
export function isTemplatelessAnnotationInScope(annotation, scopeId) {
  return (
    isTemplatelessAnnotation(annotation) &&
    Boolean(scopeId) &&
    annotation.scopeId === scopeId
  );
}

// Revolution axes and their placements belong to a base map + a scope too
// (no listing, no template — see isLegacyStyleRevolutionHelper; the types are
// inlined to keep this file import-free).
function isScopeBoundRevolutionHelper(annotation) {
  return (
    (annotation?.type === "REVOLUTION_AXIS" ||
      annotation?.type === "REVOLUTION_AXIS_PLACEMENT") &&
    !annotation.annotationTemplateId
  );
}

// Every listing-less annotation of a scope (templateless draws + revolution
// axes / placements), among rows read straight from Dexie: what the scope
// level services (Krto zip, duplicate, clear, purge) must carry along with
// the listings' annotations.
export function isScopeBoundAnnotationInScope(annotation, scopeId) {
  return (
    Boolean(scopeId) &&
    annotation?.scopeId === scopeId &&
    (isTemplatelessAnnotation(annotation) ||
      isScopeBoundRevolutionHelper(annotation))
  );
}

// Key of the per-template session maps (selectedToolKeyByTemplateId,
// draftPropsByTemplateId) for a templateless draft.
export function getTemplatelessDraftKey(drawingShape) {
  return `DRAW:${drawingShape}`;
}

// Same, from a draft: its template id, or the templateless key.
export function getDraftSessionKey(draft) {
  if (draft?.annotationTemplateId) return draft.annotationTemplateId;
  if (isTemplatelessAnnotation(draft) && draft.drawingShape)
    return getTemplatelessDraftKey(draft.drawingShape);
  return null;
}
