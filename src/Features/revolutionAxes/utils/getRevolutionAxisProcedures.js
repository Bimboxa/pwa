// "Systèmes" of a plan REVOLUTION_AXIS: the registry ANNOTATIONS_CREATOR
// procedures an axis can source WITHOUT a template (sourceAnnotationTypes)
// and that open a params dialog — château d'eau GO, réservoir. They are
// launched from the « Dessin auto » band of the listing holding their
// templates (DialogProcedureAxisLaunch: axis + vertical page, then cotes).
//
// A system is ASSOCIATED to an axis once that dialog has been confirmed on
// it: the cotes dialog persists the typed values AND the launching listing
// on the axis row (procedureParams[procedureKey].listingId) — that stored
// listing is the association mark every host reads (axis toolbar bands, axis
// row menu). An axis with no associated system shows no procedure band.
export default function getRevolutionAxisProcedures(procedures) {
  return (procedures ?? []).filter(
    (p) =>
      p?.type === "ANNOTATIONS_CREATOR" &&
      Boolean(p.paramsDialog) &&
      (p.sourceAnnotationTypes ?? []).includes("REVOLUTION_AXIS")
  );
}

/** Listing a system was launched from on this axis (association mark). */
export function getAxisSystemListingId(axis, procedureKey) {
  return axis?.procedureParams?.[procedureKey]?.listingId ?? null;
}

export function isSystemAssociatedToAxis(axis, procedureKey) {
  return Boolean(getAxisSystemListingId(axis, procedureKey));
}

/** Split the axis systems into { associated, available } for one axis. */
export function splitRevolutionAxisProcedures(axis, procedures) {
  const associated = [];
  const available = [];
  for (const p of procedures ?? []) {
    if (isSystemAssociatedToAxis(axis, p.key)) associated.push(p);
    else available.push(p);
  }
  return { associated, available };
}

/**
 * Registry procedures launched from a listing with a revolution axis as
 * parameter (`listingParams` of type REVOLUTION_AXIS — e.g. the château d'eau
 * surfaces): the axis is picked in the listing « Dessin auto » band and
 * stored in listing.procedureParams[procedureKey][paramKey].
 */
export function getAxisParamOfProcedure(procedure) {
  return (
    (procedure?.listingParams ?? []).find(
      (p) => p?.type === "REVOLUTION_AXIS"
    ) ?? null
  );
}

export function getListingAxisProcedures(procedures) {
  return (procedures ?? []).filter(
    (p) =>
      p?.type === "ANNOTATIONS_CREATOR" && Boolean(getAxisParamOfProcedure(p))
  );
}

/** Axis id a listing-level procedure is bound to on this listing. */
export function getListingProcedureAxisId(listing, procedure) {
  const param = getAxisParamOfProcedure(procedure);
  if (!param) return null;
  return listing?.procedureParams?.[procedure.key]?.[param.key] ?? null;
}
