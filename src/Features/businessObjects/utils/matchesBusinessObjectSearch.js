// Search matching of the business-objects tree (port of Krnet's
// entityMatches, notes-app src/utils/locateModel.js): case- and
// accent-insensitive substring match on the label or the code. An empty
// query matches everything. Pure module.

export function normalizeSearchText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function matchesBusinessObjectSearch(businessObject, query) {
  const q = normalizeSearchText(query).trim();
  if (!q) return true;
  return (
    normalizeSearchText(businessObject?.label).includes(q) ||
    normalizeSearchText(businessObject?.code).includes(q)
  );
}
