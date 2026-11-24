import db from "App/db/db";

import sortPhases from "../utils/sortPhases";
import groupPhaseRelsByAnnotationId from "../utils/groupPhaseRelsByAnnotationId";
import resolveAnnotationPhaseIndexes from "../utils/resolveAnnotationPhaseIndexes";

// Ids of the annotations that are NOT present in the given phase (a
// db.businessObjects id of a PHASING listing): what a view pinned on that
// phase hides (portfolio page of a « Journal des phases »). An annotation
// without any phase row is present in every phase, so it is never returned.
// Unknown / deleted phase => nothing is hidden.
export default async function getPhaseHiddenAnnotationIdsService(phaseId) {
  if (!phaseId) return [];
  const phase = await db.businessObjects.get(phaseId);
  if (!phase || phase.deletedAt) return [];

  const phases = sortPhases(
    await db.businessObjects
      .where("listingId")
      .equals(phase.listingId)
      .toArray()
  );
  const phaseIndex = phases.findIndex((p) => p.id === phaseId);
  if (phaseIndex < 0) return [];

  const rels = await db.relsPhaseAnnotation
    .where("listingId")
    .equals(phase.listingId)
    .toArray();
  const hiddenIds = [];
  groupPhaseRelsByAnnotationId(rels).forEach((annotationRels, annotationId) => {
    if (!resolveAnnotationPhaseIndexes(annotationRels, phases).has(phaseIndex))
      hiddenIds.push(annotationId);
  });
  return hiddenIds;
}
