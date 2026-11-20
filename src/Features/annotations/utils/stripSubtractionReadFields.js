// Read-time subtraction fields attached by useAnnotationsV2: they describe
// the relations of the SOURCE annotation (db.relAnnotationSubtractions) and
// must never be persisted on a copy — the 3D carve reads
// `annotation.subtractionTargets`, so a copied host would be carved by the
// original's targets without owning any relation.
const SUBTRACTION_READ_KEYS = [
  "subtractionTargetIds",
  "subtractionTargets",
  "_foreignSubtractionTargets",
  "_foreignSubtractionFootprints",
  "_blockCuttersByTargetId",
  "_blockCuttersKey",
];

/**
 * Removes, IN PLACE, the read-time subtraction fields from a row about to be
 * written as a copy of a hydrated annotation.
 *
 * `subtractOnContact` is an effective flag on a hydrated annotation
 * (annotation || template): when the template carries it, the copy must not
 * store it as its own (it would stick after the template option is turned
 * off).
 *
 * @param {Object} row the copy being built (mutated)
 * @param {Object} [hydratedSource] the hydrated annotation it comes from
 * @returns {Object} row
 */
export default function stripSubtractionReadFields(row, hydratedSource) {
  if (!row) return row;
  for (const key of SUBTRACTION_READ_KEYS) delete row[key];
  if (hydratedSource?.annotationTemplateProps?.subtractOnContact === true) {
    delete row.subtractOnContact;
  }
  return row;
}
