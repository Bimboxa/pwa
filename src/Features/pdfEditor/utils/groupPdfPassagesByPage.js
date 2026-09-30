// "Sommaire" of a PDF document: its highlighted passages
// (db.relsBusinessObjectResource rows with a page and rects) grouped by
// page, in reading order — page, then position in the page. Whole-resource
// links (no rects, no page) are not passages.
export default function groupPdfPassagesByPage(rels) {
  const passages = (rels ?? []).filter(
    (rel) => rel?.rects?.length > 0 && Number.isFinite(rel.pageNumber)
  );

  passages.sort(
    (a, b) =>
      a.pageNumber - b.pageNumber ||
      (a.rects[0].y ?? 0) - (b.rects[0].y ?? 0) ||
      (a.rects[0].x ?? 0) - (b.rects[0].x ?? 0)
  );

  const groups = [];
  for (const rel of passages) {
    const last = groups[groups.length - 1];
    if (last && last.pageNumber === rel.pageNumber) last.rels.push(rel);
    else groups.push({ pageNumber: rel.pageNumber, rels: [rel] });
  }
  return groups;
}
