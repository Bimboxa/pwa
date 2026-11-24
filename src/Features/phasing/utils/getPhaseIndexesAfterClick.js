// Period of an annotation after a click on the step `clickedIndex` of the
// phases strip — also what hovering that step previews. `currentIndexes`:
// Set of the phases it is present in.
// - before the period: the start moves back to the step;
// - after the period: the end moves forward to the step;
// - on a bound: the period collapses to that single phase;
// - strictly inside: the nearest bound moves to the step (the start on a tie).
// The holes (excluded phases) still inside the new period are kept.
//
// Pure: node-testable.
export default function getPhaseIndexesAfterClick(
  currentIndexes,
  clickedIndex
) {
  const current = [...(currentIndexes ?? [])].sort((a, b) => a - b);
  if (current.length === 0) return new Set([clickedIndex]);

  const first = current[0];
  const last = current[current.length - 1];
  let from = first;
  let to = last;
  if (clickedIndex < first) from = clickedIndex;
  else if (clickedIndex > last) to = clickedIndex;
  else if (clickedIndex === first || clickedIndex === last) {
    from = clickedIndex;
    to = clickedIndex;
  } else if (clickedIndex - first <= last - clickedIndex) from = clickedIndex;
  else to = clickedIndex;

  const holes = new Set();
  for (let index = first + 1; index < last; index++) {
    if (!currentIndexes.has(index)) holes.add(index);
  }
  const result = new Set();
  for (let index = from; index <= to; index++) {
    if (index === clickedIndex || !holes.has(index)) result.add(index);
  }
  return result;
}
