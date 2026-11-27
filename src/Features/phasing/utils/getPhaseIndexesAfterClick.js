// Phases of an annotation after a click on the step `clickedIndex` of the
// phases strip — also what hovering that step previews. `currentIndexes`:
// Set of the phases it is present in. Same gestures as the displayed phases:
// - plain click: that phase only — again on the only phase it is in: none;
// - `additive` (Shift click): that phase is added / removed.
// An annotation is always in at least one phase: "none" reads as every phase
// (`phasesCount`), like no displayed phase displays everything.
// `remove` forces the direction (a multi-selection decides it for all its
// annotations at once); omitted, it comes from `currentIndexes`.
//
// Pure: node-testable.
export default function getPhaseIndexesAfterClick(
  currentIndexes,
  clickedIndex,
  { additive = false, remove, phasesCount = 0 } = {}
) {
  const current = new Set(currentIndexes ?? []);
  let result;
  if (additive) {
    result = current;
    if (remove ?? current.has(clickedIndex)) result.delete(clickedIndex);
    else result.add(clickedIndex);
  } else {
    const isOnlyPhase = current.size === 1 && current.has(clickedIndex);
    result = (remove ?? isOnlyPhase) ? new Set() : new Set([clickedIndex]);
  }
  if (result.size === 0) {
    for (let index = 0; index < phasesCount; index++) result.add(index);
  }
  return result;
}
