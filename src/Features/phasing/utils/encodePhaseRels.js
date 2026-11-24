// Inverse of resolveAnnotationPhaseIndexes: the normalized
// [{phaseId, type}] rows of an annotation present in `activeIndexes`
// (indexes in `phases`). No START when the period starts at the first phase,
// no END when it reaches the last one (it then follows the phases added
// later), one EXCLUDE per hole. Present in every phase = no row.
// Returns null for an empty set: an annotation is always in at least one
// phase.
//
// Pure: node-testable.
export default function encodePhaseRels(activeIndexes, phases) {
  const count = phases?.length ?? 0;
  const indexes = [...new Set(activeIndexes ?? [])]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < count)
    .sort((a, b) => a - b);
  if (indexes.length === 0) return null;

  const first = indexes[0];
  const last = indexes[indexes.length - 1];
  const active = new Set(indexes);
  const rows = [];
  if (first > 0) rows.push({ phaseId: phases[first].id, type: "START" });
  if (last < count - 1) rows.push({ phaseId: phases[last].id, type: "END" });
  for (let index = first + 1; index < last; index++) {
    if (!active.has(index))
      rows.push({ phaseId: phases[index].id, type: "EXCLUDE" });
  }
  return rows;
}
