import { isTemplateLinked } from "./linkedTemplateIds.js";

// Annotations EXCLUDED from a business object's "Lien par modèle": the
// template link feeds every annotation of the template (present and
// future), an exclusion removes one of them from that expansion.
//
// Rule: an exclusion only applies while the annotation's template is linked
// by template to the object — it never subtracts anything from a per
// annotation link (db.relsBusinessObjectAnnotation), so a stale exclusion
// (template link removed, annotation deleted, template changed) is simply
// ignored at read time. The writers keep a rel and an exclusion on the same
// (object, annotation) pair mutually exclusive; the resolver lets the rel
// win if both exist anyway.
//
// Storage: businessObject.excludedAnnotationIds = [annotationId], same
// precedent as linkedTemplateIds (no Dexie bump, whitelisted in
// useUpdateBusinessObject, remapped by the Krto import).
//
// Pure module (node --test friendly): keep the imports relative with .js.

export function getExcludedAnnotationIds(businessObject) {
  const ids = businessObject?.excludedAnnotationIds;
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const result = [];
  ids.forEach((id) => {
    if (typeof id !== "string" || !id || seen.has(id)) return;
    seen.add(id);
    result.push(id);
  });
  return result;
}

export function isAnnotationExcluded(businessObject, annotationId) {
  if (!annotationId) return false;
  return getExcludedAnnotationIds(businessObject).includes(annotationId);
}

// Next excludedAnnotationIds after excluding the given annotations (deduped).
export function addExcludedAnnotationIds(businessObject, annotationIds) {
  const next = getExcludedAnnotationIds(businessObject);
  (annotationIds ?? []).forEach((id) => {
    if (typeof id !== "string" || !id || next.includes(id)) return;
    next.push(id);
  });
  return next;
}

// Next excludedAnnotationIds after re-including the given annotations.
export function removeExcludedAnnotationIds(businessObject, annotationIds) {
  const toRemove = new Set(annotationIds ?? []);
  return getExcludedAnnotationIds(businessObject).filter(
    (id) => !toRemove.has(id)
  );
}

// An exclusion has an effect only on an annotation fed by a template link:
// a non-cell annotation whose template is linked by template to the object.
export function isExclusionApplicable(businessObject, annotation) {
  if (!annotation || annotation.isMeshCell) return false;
  return isTemplateLinked(businessObject, annotation.annotationTemplateId);
}
