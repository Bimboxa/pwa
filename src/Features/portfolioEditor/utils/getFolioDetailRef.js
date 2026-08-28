import db from "App/db/db";

// Reference number of the detail shown on a FOLIO_PAGE: the page's source
// DETAIL annotation points to a detail baseMap whose detailRef is the bubble
// reference (single source of truth); annotation label is the legacy
// fallback. Same resolution as useCreateDetailsPortfolio's page titles.
export default async function getFolioDetailRef(page) {
  if (!page?.sourceAnnotationId) return null;
  const annotation = await db.annotations.get(page.sourceAnnotationId);
  if (!annotation) return null;
  if (annotation.detailBaseMapId) {
    const baseMap = await db.baseMaps.get(annotation.detailBaseMapId);
    if (baseMap?.detailRef) return baseMap.detailRef;
  }
  return annotation.label || null;
}
