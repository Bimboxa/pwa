// Links of a business object to whole annotation TEMPLATES ("Lien par
// modèle"): every annotation of a linked template in the scope, present and
// future, feeds the object's quantity (through the template's quantity
// formula, see qtyFormula.js) — unlike the per-annotation links of
// db.relsBusinessObjectAnnotation ("Lien par annotation").
//
// Storage: businessObject.linkedTemplateIds = [annotationTemplateId], same
// precedent as qtyFormulas (no Dexie bump, whitelisted in
// useUpdateBusinessObject, remapped by the Krto import). No entry for the
// annotations without template. The id of a deleted template is ignored at
// read time (no annotation of it remains in the scope).
//
// Pure module (node --test friendly): keep the imports relative with .js.

export function getLinkedTemplateIds(businessObject) {
  const ids = businessObject?.linkedTemplateIds;
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

export function isTemplateLinked(businessObject, annotationTemplateId) {
  if (!annotationTemplateId) return false;
  return getLinkedTemplateIds(businessObject).includes(annotationTemplateId);
}

// Next linkedTemplateIds after linking the given templates (deduped).
export function addLinkedTemplateIds(businessObject, annotationTemplateIds) {
  const next = getLinkedTemplateIds(businessObject);
  (annotationTemplateIds ?? []).forEach((id) => {
    if (typeof id !== "string" || !id || next.includes(id)) return;
    next.push(id);
  });
  return next;
}

// Next linkedTemplateIds after removing the given template.
export function removeLinkedTemplateId(businessObject, annotationTemplateId) {
  return getLinkedTemplateIds(businessObject).filter(
    (id) => id !== annotationTemplateId
  );
}
