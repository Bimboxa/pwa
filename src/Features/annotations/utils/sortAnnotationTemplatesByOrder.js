/**
 * Sorts annotation templates by `orderIndex` (fractional indexing), falling back
 * to `createdAt`, then consolidates groups so all members of the same
 * `groupLabel` appear together (right after the group's first member).
 *
 * Pure: returns a new array, does not mutate the input.
 *
 * @param {Array} annotationTemplates
 * @returns {Array} sorted + group-consolidated templates
 */
export default function sortAnnotationTemplatesByOrder(annotationTemplates) {
  if (!annotationTemplates) return annotationTemplates;

  // Step 1: sort by orderIndex
  const sorted = [...annotationTemplates].sort((a, b) => {
    const aIdx = a.orderIndex ?? null;
    const bIdx = b.orderIndex ?? null;
    if (aIdx && bIdx) return aIdx < bIdx ? -1 : aIdx > bIdx ? 1 : 0;
    if (aIdx && !bIdx) return -1;
    if (!aIdx && bIdx) return 1;
    return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });

  // Step 2: consolidate groups — when we encounter a groupLabel for the
  // first time, pull all other members of that group to follow it
  const result = [];
  const consumed = new Set();
  const normalizeGroup = (g) =>
    (g ?? "").trim().toUpperCase().replace(/\s+/g, "");

  for (const t of sorted) {
    if (consumed.has(t.id)) continue;
    consumed.add(t.id);
    result.push(t);

    const ng = normalizeGroup(t.groupLabel);
    if (ng) {
      // pull remaining members of this group right after
      for (const t2 of sorted) {
        if (!consumed.has(t2.id) && normalizeGroup(t2.groupLabel) === ng) {
          consumed.add(t2.id);
          result.push(t2);
        }
      }
    }
  }

  return result;
}
