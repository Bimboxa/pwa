import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";

export default function useAnnotationTemplates(options) {
  // options

  const filterByListingId = options?.filterByListingId;
  const sortByLabel = options?.sortByLabel;

  // data

  const annotationTemplatesUpdatedAt = useSelector(
    (s) => s.annotations.annotationTemplatesUpdatedAt
  );
  const editedAnnotationTemplate = useSelector(
    (s) => s.annotations.editedAnnotationTemplate
  );

  const projectId = useSelector((s) => s.projects.selectedProjectId);



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

  // sort by label
  if (sortByLabel && annotationTemplates) {
    annotationTemplates = annotationTemplates.sort((a, b) => {
      return (a.label ?? "").localeCompare(b.label ?? "");
    });
  }

  return annotationTemplates;
}
