// Phases (indexes) a new annotation is assigned to: exactly the selected
// phases, in order ("phase x and after" is a selection of the strip). Empty
// selection = no assignment (the annotation is present everywhere).
//
// Pure: node-testable.
export default function getNewAnnotationPhaseIndexes(selectedIndexes) {
  return [...new Set(selectedIndexes ?? [])].sort((a, b) => a - b);
}
