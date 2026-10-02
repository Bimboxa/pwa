// What a brush click does, given the rows painting the same part
// (findMeshPaintMatches):
// - one of them already carries the armed template → REMOVED: every match is
//   deleted (the part goes back to unpainted), nothing is added;
// - otherwise every match is deleted and the candidate is added: REPLACED
//   when something was there, ADDED on a bare part.
//
// Pure: node-testable.

export default function planPaintToggle({ matches, templateId }) {
  const list = (matches || []).filter(Boolean);
  const deleteIds = list.map((row) => row.id).filter(Boolean);
  if (list.some((row) => row.annotationTemplateId === templateId)) {
    return { action: "REMOVED", deleteIds, add: false };
  }
  return {
    action: list.length ? "REPLACED" : "ADDED",
    deleteIds,
    add: true,
  };
}
