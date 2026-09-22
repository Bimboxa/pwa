// Extra descriptor shown under a resource name. PDF pages kept as the source
// of base maps (kind = "PDF_PAGE") say which page of which PDF they are.
export default function getResourceSecondaryLabel(resource) {
  if (resource?.kind !== "PDF_PAGE") return null;
  const { pageNumber, pageCount, pdfFileName } = resource.source ?? {};
  if (!pageNumber) return null;
  const pages = pageCount ? `Page ${pageNumber}/${pageCount}` : `Page ${pageNumber}`;
  return pdfFileName ? `${pages} de ${pdfFileName}` : pages;
}
