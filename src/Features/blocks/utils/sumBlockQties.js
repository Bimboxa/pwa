// Totals of a block from the quantities of its members (getAnnotationQties
// results): {surface, length, membersCount}.
// Same rules as the per-template aggregators: developed values win over the
// plan ones, disabled quantities are skipped.
// Pure: node-testable.
export default function sumBlockQties(qtiesList) {
  const totals = { surface: 0, length: 0, membersCount: 0 };
  for (const qties of qtiesList ?? []) {
    totals.membersCount += 1;
    if (!qties?.enabled) continue;
    const surface = qties.surfaceDeveloped ?? qties.surface;
    const length = qties.lengthDeveloped ?? qties.length;
    if (Number.isFinite(surface)) totals.surface += surface;
    if (Number.isFinite(length)) totals.length += length;
  }
  return totals;
}
