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
      templates = (await db.annotationTemplates
        .where("listingId")
        .equals(filterByListingId)
        .toArray()).filter(r => !r.deletedAt);
    } else if (projectId) {
      templates = (await db.annotationTemplates
        .where("projectId")
        .equals(projectId)
        .toArray()).filter(r => !r.deletedAt);
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

  // sort by orderIndex (fractional indexing), fallback to createdAt
  // then consolidate groups so all members of the same groupLabel appear together
  if (options?.sortByOrder && annotationTemplates) {
    // Step 1: sort by orderIndex
    const sorted = [...annotationTemplates].sort((a, b) => {
      const aIdx = a.orderIndex ?? null;
      const bIdx = b.orderIndex ?? null;
      if (aIdx && bIdx) return aIdx < bIdx ? -1 : aIdx > bIdx ? 1 : 0;
      if (aIdx && !bIdx) return -1;
      if (!aIdx && bIdx) return 1;
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    });

    // Step 2: consolidate groups — when we encounter a groupLabel for the
    // first time, pull all other members of that group to follow it
    const result = [];
    const consumed = new Set();
    const normalizeGroup = (g) => (g ?? "").trim().toUpperCase().replace(/\s+/g, "");

    for (const t of sorted) {
      if (consumed.has(t.id)) continue;
      consumed.add(t.id);
      result.push(t);

      const ng = normalizeGroup(t.groupLabel);
      if (ng) {
        // pull remaining members of this group right after
        for (const t2 of sorted) {
          if (!consumed.has(t2.id) && normalizeGroup(t2.groupLabel) === ng) {
            consumed.add(t2.id);
            result.push(t2);
          }
        }
      }
    }

    annotationTemplates = result;
  }

  return annotationTemplates;
}
