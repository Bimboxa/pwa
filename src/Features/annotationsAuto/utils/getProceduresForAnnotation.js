// ANNOTATIONS_CREATOR procedures an annotation can be the source of:
// - the procedures linked by its template (template.procedureKeys);
// - the procedures linked by its listing (listing.procedureKeys) that declare
//   one of the template's mapping categories as a source
//   (entry.sourceMappingCategories);
// - the registry entries that declare its TYPE as a template-less source
//   (entry.sourceAnnotationTypes — e.g. a REVOLUTION_AXIS, which belongs to a
//   base map + scope and carries no template).
//
// `template` defaults to the annotation's resolved template; `listing` is the
// annotation's listing row (optional: without it, listing-level links are
// ignored).
export default function getProceduresForAnnotation(
  annotation,
  procedures,
  { listing, template } = {}
) {
  if (!annotation) return [];
  const all = (procedures ?? []).filter(
    (p) => p?.type === "ANNOTATIONS_CREATOR"
  );
  const sourceTemplate = template ?? annotation.annotationTemplate;
  const templateKeys = sourceTemplate?.procedureKeys ?? [];
  const templateCategories = sourceTemplate?.mappingCategories ?? [];
  const listingKeys = listing?.procedureKeys ?? [];
  return all.filter(
    (p) =>
      templateKeys.includes(p.key) ||
      (listingKeys.includes(p.key) &&
        (p.sourceMappingCategories ?? []).some((c) =>
          templateCategories.includes(c)
        )) ||
      (p.sourceAnnotationTypes ?? []).includes(annotation.type)
  );
}
