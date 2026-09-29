import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";
import { selectHiddenAnnotationTemplateIds } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";

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

  // Template visibility (the "eye") is per-scope LOCAL state (scopeVisibility
  // slice + localStorage), no longer the persisted `hidden` field: derived
  // here for every reader, overriding whatever a legacy row still carries.
  const hiddenIds = useSelector(selectHiddenAnnotationTemplateIds);
  const hiddenIdsKey = hiddenIds.join(",");

  const rawAnnotationTemplates = useLiveQuery(async () => {
    let templates = [];
    if (filterByListingId) {
      templates = (
        await db.annotationTemplates
          .where("listingId")
          .equals(filterByListingId)
          .toArray()
      ).filter((r) => !r.deletedAt);
    } else if (projectId) {
      templates = (
        await db.annotationTemplates
          .where("projectId")
          .equals(projectId)
          .toArray()
      ).filter((r) => !r.deletedAt);
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

  // Memoized on the rows + the hidden key: useAnnotationsV2 recomputes its
  // whole stage B on the identity of this array.
  let annotationTemplates = useMemo(() => {
    if (!rawAnnotationTemplates) return rawAnnotationTemplates;
    const hiddenSet = new Set(hiddenIdsKey ? hiddenIdsKey.split(",") : []);
    return rawAnnotationTemplates.map((t) => ({
      ...t,
      hidden: hiddenSet.has(t.id),
    }));
  }, [rawAnnotationTemplates, hiddenIdsKey]);

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

  // sort by orderIndex (fractional indexing), fallback to createdAt
  // then consolidate groups so all members of the same groupLabel appear together
  if (options?.sortByOrder && annotationTemplates) {
    annotationTemplates = sortAnnotationTemplatesByOrder(annotationTemplates);
  }

  return annotationTemplates;
}
