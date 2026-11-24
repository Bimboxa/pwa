import db from "App/db/db";

import setAnnotationsPhasesService from "./setAnnotationsPhasesService";

import groupPhaseRelsByAnnotationId from "../utils/groupPhaseRelsByAnnotationId";
import resolveAnnotationPhaseIndexes from "../utils/resolveAnnotationPhaseIndexes";

// Called right after a phase was appended to a listing. `phases`: the ordered
// phases INCLUDING the new, last one.
// - activate: the annotations present in the previous last phase are present
//   in the new one too. Open periods (no END) already are; the periods
//   ending on the previous phase are extended.
// - not activate: the new phase starts empty — every annotation present in
//   the previous last phase stops there. That includes the annotations of
//   the scope without any phase row (present everywhere until now).
// One batch, no undo entry (the phase creation is not undoable either).
export default async function applyNewPhaseActivationService({
  listing,
  phases,
  activate,
}) {
  if (!listing?.id || !phases || phases.length < 2) return 0;
  const newIndex = phases.length - 1;
  const previousIndex = newIndex - 1;

  const rels = (
    await db.relsPhaseAnnotation.where("listingId").equals(listing.id).toArray()
  ).filter((r) => !r.deletedAt);
  const relsByAnnotationId = groupPhaseRelsByAnnotationId(rels);

  const indexesByAnnotationId = new Map();
  relsByAnnotationId.forEach((annotationRels, annotationId) => {
    const indexes = resolveAnnotationPhaseIndexes(annotationRels, phases);
    if (!indexes.has(previousIndex)) return;
    if (activate === indexes.has(newIndex)) return;
    if (activate) indexes.add(newIndex);
    else indexes.delete(newIndex);
    indexesByAnnotationId.set(annotationId, indexes);
  });

  if (!activate) {
    // annotations without any row: present in every phase so far
    const listingIds = (
      await db.listings.where("scopeId").equals(listing.scopeId).toArray()
    )
      .filter((l) => !l.deletedAt)
      .map((l) => l.id);
    const annotations = listingIds.length
      ? await db.annotations.where("listingId").anyOf(listingIds).toArray()
      : [];
    const allButNew = phases.slice(0, newIndex).map((_, index) => index);
    annotations.forEach((a) => {
      if (a.deletedAt || a.isBaseMapAnnotation) return;
      if (relsByAnnotationId.has(a.id)) return;
      indexesByAnnotationId.set(a.id, new Set(allButNew));
    });
  }

  if (indexesByAnnotationId.size === 0) return 0;
  return setAnnotationsPhasesService({
    listing,
    phases,
    indexesByAnnotationId,
    skipUndo: true,
  });
}
