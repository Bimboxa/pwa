import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";

export default function useAnnotationTemplates(options) {
  // data

  const annotationTemplatesUpdatedAt = useSelector(
    (s) => s.annotations.annotationTemplatesUpdatedAt
  );
  const editedAnnotationTemplate = useSelector(
    (s) => s.annotations.editedAnnotationTemplate
  );

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const filterByListingId = options?.filterByListingId;

  let annotationTemplates = useLiveQuery(async () => {
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

  // edition
  if (editedAnnotationTemplate && annotationTemplates) {
    annotationTemplates = annotationTemplates.map((template) => {
      if (template.id === editedAnnotationTemplate.id) {
        return editedAnnotationTemplate;
      }
      return template;
    });
  }

  return annotationTemplates;
}
