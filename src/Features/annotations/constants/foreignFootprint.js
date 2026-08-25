// Read-only "footprint" annotations: the silhouette of a subtraction target
// hosted by ANOTHER base map, projected onto the displayed one so the relation
// stays visible and clickable from the plan.
//
// Their id is deliberately prefixed: it matches no row in db.annotations, so a
// drag / delete / update that slips through targets nothing and can never
// corrupt the original (same guard idea as the "label::" selection prefix).
// They are synthesized by useAnnotationsV2 only when `withForeignFootprints`
// is set — quantity, listing and export callers never see them.

export const FOREIGN_FOOTPRINT_ID_PREFIX = "foreign::";

export function isForeignFootprintId(id) {
  return typeof id === "string" && id.startsWith(FOREIGN_FOOTPRINT_ID_PREFIX);
}

export function getForeignFootprintSourceId(id) {
  return isForeignFootprintId(id)
    ? id.slice(FOREIGN_FOOTPRINT_ID_PREFIX.length)
    : null;
}
