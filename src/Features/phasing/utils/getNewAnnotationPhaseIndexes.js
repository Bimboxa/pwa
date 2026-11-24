// Phases (indexes) a new annotation is assigned to, from the selected phases:
// - one selected phase: that phase only (mode "ONLY") or that phase and every
//   following one (mode "FROM" — the default: what is built stays);
// - several: exactly the selected phases.
// Empty selection = no assignment (the annotation is present everywhere).
//
// Pure: node-testable.
export default function getNewAnnotationPhaseIndexes(
  selectedIndexes,
  phasesCount,
  mode
) {
  const indexes = [...new Set(selectedIndexes ?? [])].sort((a, b) => a - b);
  if (indexes.length !== 1 || mode === "ONLY") return indexes;
  const result = [];
  for (let index = indexes[0]; index < phasesCount; index++) result.push(index);
  return result;
}
