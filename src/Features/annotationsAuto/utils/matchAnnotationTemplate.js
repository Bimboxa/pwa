/**
 * Find a target annotationTemplate whose mappingCategories overlap
 * with the given category strings (e.g. ["OUVRAGE:VCT"]).
 *
 * Returns the first matching template, or null.
 */
export default function matchAnnotationTemplate(templates, categoryStrings) {
  if (!templates?.length || !categoryStrings?.length) return null;

  for (const template of templates) {
    const templateCategories = template.mappingCategories ?? [];
    const hasMatch = categoryStrings.some((cat) =>
      templateCategories.includes(cat)
    );
    if (hasMatch) return template;
  }

  return null;
}
