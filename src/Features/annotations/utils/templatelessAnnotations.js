// ---------------------------------------------------------------------------
// Templateless annotations — drawn from the "Dessin" tool (hotkey D): no
// annotation template. Two populations, told apart by `listingId`:
// - scope-level (no listing): they belong to a base map + a scope only
//   (`baseMapId` + `scopeId`) — the « Annotations sans modèle » row of the
//   Dessin module;
// - listing-bound: drawn while an object of a located business-objects
//   listing is active, they carry that listing's id (+ scopeId) and are the
//   object's main annotations — the « Sans modèle » row of the listing.
// Both carry their own style.
//
// Solo / eye reuse the template mechanisms (soloAnnotationTemplateId,
// scopeVisibility.hiddenAnnotationTemplateIds) through sentinel template ids:
// the global one for the scope-level rows, `<global>:<listingId>` per
// listing for the listing-bound ones (getTemplatelessTemplateKey).
// ---------------------------------------------------------------------------

export const TEMPLATELESS_TEMPLATE_ID = "__TEMPLATELESS__";

export const TEMPLATELESS_LABEL = "Sans modèle";

export const DEFAULT_TEMPLATELESS_DRAWING_SHAPE = "POLYLINE";

export function isTemplatelessAnnotation(annotation) {
  return Boolean(annotation?.isTemplateless);
}

// Sentinel template id of the templateless annotations: the global one, or
// the per-listing one of a business-objects listing's « Sans modèle » row.
export function getTemplatelessTemplateKey(listingId) {
  return listingId
    ? `${TEMPLATELESS_TEMPLATE_ID}:${listingId}`
    : TEMPLATELESS_TEMPLATE_ID;
}

// Is `key` one of the templateless sentinels (global or per listing)?
export function isTemplatelessTemplateKey(key) {
  return typeof key === "string" && key.startsWith(TEMPLATELESS_TEMPLATE_ID);
}

// Template id used by the solo / hidden filters: the sentinel for templateless
// annotations (per listing when they carry one).
export function getAnnotationTemplateKey(annotation) {
  return (
    annotation?.annotationTemplateId ??
    (isTemplatelessAnnotation(annotation)
      ? getTemplatelessTemplateKey(annotation.listingId)
      : undefined)
  );
}

// Scope-level templateless annotations of a scope (no listing), among rows
// read straight from Dexie. The listing-bound ones follow their listing.
export function isTemplatelessAnnotationInScope(annotation, scopeId) {
  return (
    isTemplatelessAnnotation(annotation) &&
    !annotation.listingId &&
    Boolean(scopeId) &&
    annotation.scopeId === scopeId
  );
}

// Templateless annotations drawn on the objects of a business-objects
// listing (« Sans modèle » row of the listing).
export function isListingTemplatelessAnnotation(annotation, listingId) {
  return (
    isTemplatelessAnnotation(annotation) &&
    Boolean(listingId) &&
    annotation.listingId === listingId
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

// Every listing-less annotation of a scope (scope-level templateless draws +
// revolution axes / placements), among rows read straight from Dexie: what
// the scope level services (Krto zip, duplicate, clear, purge) must carry
// along with the listings' annotations. The listing-bound templateless rows
// follow their listing there.
export function isScopeBoundAnnotationInScope(annotation, scopeId) {
  return (
    Boolean(scopeId) &&
    annotation?.scopeId === scopeId &&
    ((isTemplatelessAnnotation(annotation) && !annotation.listingId) ||
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
