import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";

export default function useAnnotationTemplates(options) {
  // data

  const annotationTemplatesUpdatedAt = useSelector(
    (s) => s.annotations.annotationTemplatesUpdatedAt
  );

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const filterByListingId = options?.filterByListingId;

  return useLiveQuery(async () => {
    let templates = [];
    if (filterByListingId) {
      templates = await db.annotationTemplates
        .where("listingId")
        .equals(filterByListingId)
        .toArray();
    } else if (projectId) {
      templates = await db.annotationTemplates
        .where("projectId")
        .equals(projectId)
        .toArray();
    }
    // add images
    if (templates) {
      templates = await Promise.all(
        templates.map(async (template) => {
          const { entityWithImages } = await getEntityWithImagesAsync(template);
          return entityWithImages;
        })
      );
    }

    return templates;
  }, [filterByListingId, annotationTemplatesUpdatedAt, projectId]);
}
