// Predicates of the BASE_MAP_LINK section marks ("trait de coupe").
//
// Two storage models coexist:
// - scope-bound (current): no template, no listing — the row carries its own
//   `scopeId`, like the revolution axes. Drawn from the Fonds de plan module.
// - legacy: a normal listing annotation with an `annotationTemplateId`.
//
// A SOURCE mark sits on a plan; its CLONE (`sourceLinkAnnotationId`) is the
// same mark located on a VERTICAL base map.
export const BASE_MAP_LINK_TYPE = "BASE_MAP_LINK";

export function isBaseMapLinkAnnotation(annotation) {
  return annotation?.type === BASE_MAP_LINK_TYPE;
}

export function isBaseMapLinkClone(annotation) {
  return (
    isBaseMapLinkAnnotation(annotation) &&
    Boolean(annotation.sourceLinkAnnotationId)
  );
}

export function isBaseMapLinkSource(annotation) {
  return (
    isBaseMapLinkAnnotation(annotation) && !annotation.sourceLinkAnnotationId
  );
}

/** Scope-bound section mark (no template): belongs to a base map + a scope. */
export function isScopeBoundBaseMapLink(annotation) {
  return (
    isBaseMapLinkAnnotation(annotation) && !annotation.annotationTemplateId
  );
}

// Scope rule, mirroring isRevolutionHelperInScope: scope-bound rows carry
// their own scopeId (none = visible in every scope), legacy rows follow their
// listing's scope. With no selected scope, everything is in scope.
export function isBaseMapLinkInScope(
  annotation,
  { scopeId, scopeIdByListingId }
) {
  if (!scopeId) return true;
  if (isScopeBoundBaseMapLink(annotation)) {
    return !annotation.scopeId || annotation.scopeId === scopeId;
  }
  return scopeIdByListingId?.get(annotation.listingId) === scopeId;
}
