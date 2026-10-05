// Pure plan of the revolution axes migration (node-testable, no imports).
//
// Axes and placements used to be template-driven listing annotations
// (listingId + annotationTemplateId + layerId). They now belong to their base
// map + scope: `scopeId` (the scope of the listing they were in), no listing,
// no template, no layer. Their templates (drawingShape REVOLUTION_AXIS) are
// removed once no other annotation uses them.
//
// @param {Object[]} annotations — rows of the REVOLUTION_AXIS templates
//   (any type: a template may also carry non-helper rows).
// @param {Object[]} templates — the REVOLUTION_AXIS templates.
// @param {Map<string, string>|Object} scopeIdByListingId
// @returns {{updates: {id, changes}[], templateIdsToDelete: string[]}}
const HELPER_TYPES = ["REVOLUTION_AXIS", "REVOLUTION_AXIS_PLACEMENT"];

function getScopeId(scopeIdByListingId, listingId) {
  if (!scopeIdByListingId || !listingId) return null;
  if (scopeIdByListingId instanceof Map)
    return scopeIdByListingId.get(listingId) ?? null;
  return scopeIdByListingId[listingId] ?? null;
}

export default function getRevolutionAxesMigrationPlan({
  annotations,
  templates,
  scopeIdByListingId,
}) {
  const templateIds = new Set(
    (templates ?? []).filter((t) => !t.deletedAt).map((t) => t.id)
  );
  const updates = [];
  const keptTemplateIds = new Set();

  for (const a of annotations ?? []) {
    if (!a?.annotationTemplateId || !templateIds.has(a.annotationTemplateId))
      continue;
    if (!HELPER_TYPES.includes(a.type)) {
      // a live non-helper row still needs its template
      if (!a.deletedAt) keptTemplateIds.add(a.annotationTemplateId);
      continue;
    }
    // Scope: the row's own one when already set, else its listing's. A row
    // whose listing is gone keeps its template link (still readable as is).
    const scopeId = a.scopeId ?? getScopeId(scopeIdByListingId, a.listingId);
    if (!scopeId) {
      if (!a.deletedAt) keptTemplateIds.add(a.annotationTemplateId);
      continue;
    }
    updates.push({
      id: a.id,
      changes: {
        scopeId,
        listingId: null,
        annotationTemplateId: null,
        layerId: null,
      },
    });
  }

  return {
    updates,
    templateIdsToDelete: [...templateIds].filter(
      (id) => !keptTemplateIds.has(id)
    ),
  };
}
