// « 12 annotation(s) », « 58 partie(s) peinte(s) » or both — what a
// procedure created / what a sweep deleted. Empty string when nothing.
// Pure: node-testable.
export default function formatProcedureOutputsCount({
  annotations = 0,
  paints = 0,
} = {}) {
  const parts = [];
  if (annotations > 0) parts.push(`${annotations} annotation(s)`);
  if (paints > 0) parts.push(`${paints} partie(s) peinte(s)`);
  return parts.join(" et ");
}

// Tooltip of a delete button.
export function formatDeleteOutputsTitle(counts) {
  const s = formatProcedureOutputsCount(counts);
  return s ? `Supprimer : ${s} créée(s)` : "Rien à supprimer";
}

// Toaster after a sweep (null when nothing was deleted).
export function formatDeletedOutputsMessage(counts) {
  const s = formatProcedureOutputsCount(counts);
  return s ? `${s} supprimée(s)` : null;
}
