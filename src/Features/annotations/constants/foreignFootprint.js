// Read-only "footprint" annotations: projections, onto the displayed base map,
// of annotations that live elsewhere — so a relation stays visible and
// clickable from the plan. Two kinds share the mechanism:
//   - "foreign::<id>"    the silhouette of a subtraction target hosted by
//                         ANOTHER base map (cross-base-map subtraction);
//   - "revolution::<id>" the plan footprint (disc / annulus / sector) of an
//                         annotation revolved around a REVOLUTION_AXIS drawn
//                         on this plan (see getRevolutionFootprintRings).
//
// Their id is deliberately prefixed: it matches no row in db.annotations, so a
// drag / delete / update that slips through targets nothing and can never
// corrupt the original (same guard idea as the "label::" selection prefix).
// They are synthesized by useAnnotationsV2 only when `withForeignFootprints` /
// `withRevolutionFootprints` is set — quantity, listing and export callers
// never see them. Both carry `isForeignFootprint: true` (the generic
// "read-only projection" flag every guard keys on); revolution ones add
// `isRevolutionFootprint: true`.

export const FOREIGN_FOOTPRINT_ID_PREFIX = "foreign::";
export const REVOLUTION_FOOTPRINT_ID_PREFIX = "revolution::";

const PREFIXES = [FOREIGN_FOOTPRINT_ID_PREFIX, REVOLUTION_FOOTPRINT_ID_PREFIX];

// True for ANY read-only footprint id (both kinds).
export function isForeignFootprintId(id) {
  return typeof id === "string" && PREFIXES.some((p) => id.startsWith(p));
}

export function isRevolutionFootprintId(id) {
  return (
    typeof id === "string" && id.startsWith(REVOLUTION_FOOTPRINT_ID_PREFIX)
  );
}

export function getForeignFootprintSourceId(id) {
  if (typeof id !== "string") return null;
  const prefix = PREFIXES.find((p) => id.startsWith(p));
  return prefix ? id.slice(prefix.length) : null;
}
