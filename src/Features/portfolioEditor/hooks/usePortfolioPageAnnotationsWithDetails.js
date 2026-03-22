import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

/**
 * Hook that returns annotations with entity details (image/description)
 * for all containers of a given portfolio page.
 */
export default function usePortfolioPageAnnotationsWithDetails({ pageId }) {
  const annotations = useLiveQuery(async () => {
    if (!pageId) return [];

    // get containers for this page
    const containers = (
      await db.portfolioBaseMapContainers
        .where("portfolioPageId")
        .equals(pageId)
        .toArray()
    ).filter((c) => !c.deletedAt && c.baseMapId);

    if (!containers.length) return [];

    // collect unique baseMapIds
    const baseMapIds = [...new Set(containers.map((c) => c.baseMapId))];

    // fetch all annotations for these baseMaps
    const allAnnotations = (
      await db.annotations
        .where("baseMapId")
        .anyOf(baseMapIds)
        .toArray()
    ).filter((a) => !a.deletedAt && !a.isBaseMapAnnotation);

    // apply per-container visibility filters and deduplicate
    const seenIds = new Set();
    const visibleAnnotations = [];

    for (const container of containers) {
      const disabledTemplates = new Set(
        container.disabledAnnotationTemplates || []
      );
      const disabledLayers = new Set(container.disabledLayerIds || []);

      for (const annotation of allAnnotations) {
        if (annotation.baseMapId !== container.baseMapId) continue;
        if (seenIds.has(annotation.id)) continue;
        if (disabledTemplates.has(annotation.annotationTemplateId)) continue;
        if (annotation.layerId && disabledLayers.has(annotation.layerId))
          continue;

        seenIds.add(annotation.id);
        visibleAnnotations.push(annotation);
      }
    }

    if (!visibleAnnotations.length) return [];

    // fetch listings for table lookup
    const listingIds = [
      ...new Set(visibleAnnotations.map((a) => a.listingId).filter(Boolean)),
    ];
    const listings = await db.listings
      .where("id")
      .anyOf(listingIds)
      .toArray();
    const listingsMap = getItemsByKey(listings, "id");

    // hydrate entities with images
    const enriched = await Promise.all(
      visibleAnnotations.map(async (annotation) => {
        const table =
          annotation.listingTable ||
          listingsMap[annotation.listingId]?.table;
        if (!table || !annotation.entityId) return annotation;

        const entity = await db[table].get(annotation.entityId);
        if (!entity) return annotation;

        const { entityWithImages, hasImages } =
          await getEntityWithImagesAsync(entity);

        return {
          ...annotation,
          entity: entityWithImages,
          hasImages,
          label: entityWithImages?.label,
        };
      })
    );

    // filter for annotations that have entity images
    return enriched.filter((a) => a.entity?.image?.imageUrlClient);
  }, [pageId]);

  return annotations || [];
}
