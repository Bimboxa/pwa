/**
 * Find a target annotationTemplate whose mappingCategories overlap
 * with the given category strings (e.g. ["OUVRAGE:VCT"]).
 *
 * Several templates may match (e.g. GO cuvelage « Sol » = [OUVRAGE:SOL] and
 * « Rampe » = [OUVRAGE:SOL, OUVRAGE:RAMPE]): the most specific one wins —
 * fewest mappingCategories — so the result does not depend on the templates
 * order (Dexie returns them by id). Ties keep the first match.
 *
 * Returns the matching template, or null.
 */
export default function matchAnnotationTemplate(templates, categoryStrings) {
  if (!templates?.length || !categoryStrings?.length) return null;

  let best = null;
  for (const template of templates) {
    const templateCategories = template.mappingCategories ?? [];
    const hasMatch = categoryStrings.some((cat) =>
      templateCategories.includes(cat)
    );
    if (!hasMatch) continue;
    const bestCount = best?.mappingCategories?.length ?? Infinity;
    if (templateCategories.length < bestCount) best = template;
  }

  return best;
}
