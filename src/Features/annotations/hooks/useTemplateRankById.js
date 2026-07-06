import { useMemo } from "react";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useAnnotationTemplatesByProject from "./useAnnotationTemplatesByProject";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";

/**
 * Global order of annotation templates: listings in scope order (rank),
 * then templates sorted by orderIndex (fractional indexing) within each
 * listing. Templates whose listing is not in the scope come last.
 *
 * @returns {Map<string, number>} templateId -> rank
 */
export default function useTemplateRankById() {
  const { value: listings } = useListingsByScope();
  const templates = useAnnotationTemplatesByProject();

  return useMemo(() => {
    const rankById = new Map();
    let rank = 0;

    const templatesByListingId = {};
    for (const template of templates ?? []) {
      (templatesByListingId[template.listingId] ??= []).push(template);
    }

    for (const listing of listings ?? []) {
      const sorted = sortAnnotationTemplatesByOrder(
        templatesByListingId[listing.id] ?? []
      );
      for (const template of sorted) rankById.set(template.id, rank++);
    }

    // templates whose listing is not in the scope
    const remaining = (templates ?? []).filter((t) => !rankById.has(t.id));
    for (const template of sortAnnotationTemplatesByOrder(remaining)) {
      rankById.set(template.id, rank++);
    }

    return rankById;
  }, [listings, templates]);
}
