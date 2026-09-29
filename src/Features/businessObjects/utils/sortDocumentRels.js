// Reading order of document links (db.relsBusinessObjectResource rows):
// document name, page, then position in the page. Whole-resource links (no
// page, no rects) come first within their document.
export default function sortDocumentRels(rels) {
  return [...(rels ?? [])].sort(
    (a, b) =>
      (a.resourceName ?? "").localeCompare(b.resourceName ?? "") ||
      (a.pageNumber ?? 0) - (b.pageNumber ?? 0) ||
      (a.rects?.[0]?.y ?? 0) - (b.rects?.[0]?.y ?? 0)
  );
}
