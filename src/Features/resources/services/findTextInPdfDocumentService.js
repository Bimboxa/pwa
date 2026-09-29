import findTextRectsInPdfTextItems from "../utils/findTextRectsInPdfTextItems";

// Pages looked at around the expected one: the page numbers given by a
// reader often follow the printed folio, a few pages off the PDF's.
const NEIGHBOUR_PAGES = 3;
const MAX_SCANNED_PAGES = 400;

/**
 * Locates a text (title of a CCTP…) in a loaded PDF: the expected page first,
 * then its neighbours; the whole document when no page is given.
 *
 * `pagesCache` (Map) keeps the text of the pages already read across calls.
 *
 * @returns {Promise<{pageNumber: number, rects: Array, text: string} | null>}
 *   `rects` normalized in the frame of the page at its INTRINSIC rotation
 *   (see db.relsBusinessObjectResource).
 */
export default async function findTextInPdfDocumentService({
  pdfDocument,
  text,
  pageNumber = null,
  pagesCache = new Map(),
}) {
  if (!pdfDocument || !text) return null;
  const pageCount = pdfDocument.numPages;

  let candidates = [];
  if (pageNumber) {
    candidates = [pageNumber];
    for (let d = 1; d <= NEIGHBOUR_PAGES; d++)
      candidates.push(pageNumber + d, pageNumber - d);
  } else {
    for (let p = 1; p <= Math.min(pageCount, MAX_SCANNED_PAGES); p++)
      candidates.push(p);
  }

  for (const candidate of candidates) {
    if (candidate < 1 || candidate > pageCount) continue;
    if (!pagesCache.has(candidate)) {
      const page = await pdfDocument.getPage(candidate);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      pagesCache.set(candidate, {
        items: content.items,
        viewport: {
          width: viewport.width,
          height: viewport.height,
          transform: viewport.transform,
        },
      });
      page.cleanup();
    }
    const found = findTextRectsInPdfTextItems({
      ...pagesCache.get(candidate),
      text,
    });
    if (found) return { pageNumber: candidate, ...found };
  }
  return null;
}
