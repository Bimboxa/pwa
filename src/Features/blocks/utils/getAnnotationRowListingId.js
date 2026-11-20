// Listing an annotation is listed / counted under in the template rows.
//
// A block instance is a scope-level row (no `listingId`), but it carries the
// id of the BLOCK template of its block: it counts in that template's
// listing. Any other annotation: its own listing.
// templateById: {[annotationTemplateId]: template}. Pure: node-testable.
export default function getAnnotationRowListingId(annotation, templateById) {
  if (annotation?.listingId) return annotation.listingId;
  if (annotation?.type !== "BLOCK_INSTANCE") return null;
  return templateById?.[annotation.annotationTemplateId]?.listingId ?? null;
}
