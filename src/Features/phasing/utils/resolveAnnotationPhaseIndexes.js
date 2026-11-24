// Indexes (in `phases`, the ordered phases of the listing) of the phases an
// annotation is present in, from its db.relsPhaseAnnotation rows:
// - START: first phase (none = the first of the listing);
// - END: last phase (none = the last of the listing, whatever is added later);
// - EXCLUDE: a phase taken out of that period.
// No row at all = every phase. Rows pointing at a phase that is not in
// `phases` (deleted) are ignored; a START after its END (phases reordered)
// reads as the same period, bounds swapped.
//
// Pure: node-testable.
export default function resolveAnnotationPhaseIndexes(rels, phases) {
  const count = phases?.length ?? 0;
  const result = new Set();
  if (count === 0) return result;

  const indexById = new Map(phases.map((phase, index) => [phase.id, index]));
  let start = null;
  let end = null;
  const excluded = new Set();
  for (const rel of rels ?? []) {
    const index = indexById.get(rel.phaseId);
    if (index === undefined) continue;
    if (rel.type === "START") start = index;
    else if (rel.type === "END") end = index;
    else if (rel.type === "EXCLUDE") excluded.add(index);
  }
  if (start !== null && end !== null && start > end)
    [start, end] = [end, start];

  const from = start ?? 0;
  const to = end ?? count - 1;
  for (let index = from; index <= to; index++) {
    if (!excluded.has(index)) result.add(index);
  }
  return result;
}
