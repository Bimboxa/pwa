import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import db from "App/db/db";
import useAnnotationTemplatesListingInMapEditor from "./useAnnotationTemplatesListingInMapEditor";

import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";

export default function useAnnotationTemplatesBySelectedListing(options) {
  // options

  const sortByLabel = options?.sortByLabel;
  const splitByIsFromAnnotation = options?.splitByIsFromAnnotation;

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const atl = useAnnotationTemplatesListingInMapEditor();

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  return useLiveQuery(async () => {
    let templates = [];
    if (projectId) {
      templates = await db.annotationTemplates
        .where("projectId")
        .equals(projectId)
        .toArray();

      templates = templates.filter(
        (template) =>
          template.listingId === atl?.id || template.listingId === listingId
      );
    } else {
      templates = [];
    }

    // add images

    templates = await Promise.all(
      templates.map(async (template) => {
        const { entityWithImages, hasImages } = await getEntityWithImagesAsync(
          template
        );
        return entityWithImages;
      })
    );

    // sort

    if (sortByLabel) {
      templates = templates.sort((a, b) =>
        (a.label ?? "").localeCompare(b.label ?? "")
      );
    }

    if (splitByIsFromAnnotation) {
      // helpers - sorted items

      const items1 = templates?.filter((t) => !t.isFromAnnotation) ?? [];
      const items2 = templates?.filter((t) => t.isFromAnnotation) ?? [];
      templates = [...items1, { isDivider: true }, ...items2];
    }
    return templates;
  }, [projectId, listingId, atl?.id, annotationsUpdatedAt]);
}
