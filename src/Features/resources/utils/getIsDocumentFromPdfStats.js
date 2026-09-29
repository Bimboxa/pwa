// Heuristic "is this PDF a text document (CCTP, DPGF…) or a plan?".
// `pages` = stats of the sampled pages: [{charCount, widthPt, heightPt}].
// A document has a lot of extractable text on office-sized pages; a plan is
// either a large sheet or a page with few characters (title block, labels).

export const MIN_AVERAGE_CHAR_COUNT = 500;
export const MAX_PAGE_LONG_SIDE_PT = 1200; // A3 long side = 1191 pt

export default function getIsDocumentFromPdfStats({ pages } = {}) {
  const sampled = (pages ?? []).filter(Boolean);
  if (sampled.length === 0) return false;

  const hasLargeSheet = sampled.some(
    (p) => Math.max(p.widthPt ?? 0, p.heightPt ?? 0) > MAX_PAGE_LONG_SIDE_PT
  );
  if (hasLargeSheet) return false;

  const average =
    sampled.reduce((sum, p) => sum + (p.charCount ?? 0), 0) / sampled.length;
  return average >= MIN_AVERAGE_CHAR_COUNT;
}
