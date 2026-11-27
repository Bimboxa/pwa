import groupPhaseRelsByAnnotationId from "./groupPhaseRelsByAnnotationId.js";
import resolveAnnotationPhaseIndexes from "./resolveAnnotationPhaseIndexes.js";

// Ids of the annotations that are NEW in the displayed phases: their first
// phase is the earliest displayed one or a later one. Everything else shown
// (annotations started in an earlier phase, annotations without any phase
// row — present from the first phase) is "old".
// Returns null when nothing can be old: no displayed phase, or the first
// phase of the listing is displayed.
//
// Pure: node-testable.
export default function getPhaseNewAnnotationIds(
  rels,
  phases,
  selectedPhaseIds
) {
  const selected = new Set(selectedPhaseIds ?? []);
  const firstSelectedIndex = (phases ?? []).findIndex((phase) =>
    selected.has(phase.id)
  );
  if (firstSelectedIndex <= 0) return null;

  const ids = [];
  groupPhaseRelsByAnnotationId(rels ?? []).forEach((annotationRels, id) => {
    const indexes = resolveAnnotationPhaseIndexes(annotationRels, phases);
    if (indexes.size > 0 && Math.min(...indexes) >= firstSelectedIndex)
      ids.push(id);
  });
  return ids;
}
