import { useDispatch } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "../annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import useUpdateAnnotationTemplate from "./useUpdateAnnotationTemplate";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useUpdateListing from "Features/listings/hooks/useUpdateListing";

import db from "App/db/db";

export default function useMoveAnnotationTemplateToListing() {
  const dispatch = useDispatch();

  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const updateEntity = useUpdateEntity();
  const updateListing = useUpdateListing();

  return async (annotationTemplateId, targetListingId) => {
    if (!annotationTemplateId || !targetListingId) return;

    // Get the annotation template
    const annotationTemplate = await db.annotationTemplates.get(
      annotationTemplateId
    );
    if (!annotationTemplate) return;

    // Prevent moving to the same listing
    if (annotationTemplate.listingId === targetListingId) return;

    const originListingId = annotationTemplate.listingId;

    // Get origin and target listings
    const originListing = originListingId
      ? await db.listings.get(originListingId)
      : null;
    const targetListing = await db.listings.get(targetListingId);
    if (!targetListing) return;

    // 1. Find all annotations related to this annotation template (BEFORE updating them)
    const annotations = await db.annotations
      .where("annotationTemplateId")
      .equals(annotationTemplateId)
      .toArray();

    const annotationIds = annotations.map((a) => a.id);

    // 2. Update origin listing's sortedAnnotationIds (remove moved annotations)
    // Do this BEFORE updating annotations, so we can still query them by originListingId
    if (originListing) {
      let originSortedIds = originListing.sortedAnnotationIds;

      // If sortedAnnotationIds doesn't exist, create it from current annotations
      if (!Array.isArray(originSortedIds)) {
        const originAnnotations = await db.annotations
          .where("listingId")
          .equals(originListingId)
          .toArray();
        originSortedIds = originAnnotations.map((a) => a.id);
      }

      // Remove moved annotation IDs
      originSortedIds = originSortedIds.filter(
        (id) => !annotationIds.includes(id)
      );

      await updateListing({
        id: originListingId,
        sortedAnnotationIds: originSortedIds,
      });
    }

    // 3. Update target listing's sortedAnnotationIds (add moved annotations)
    // Do this BEFORE updating annotations, so we can still query them correctly
    let targetSortedIds = targetListing.sortedAnnotationIds;

    // If sortedAnnotationIds doesn't exist, create it from current annotations
    if (!Array.isArray(targetSortedIds)) {
      const targetAnnotations = await db.annotations
        .where("listingId")
        .equals(targetListingId)
        .toArray();
      targetSortedIds = targetAnnotations.map((a) => a.id);
    }

    // Remove any duplicates that might already exist
    targetSortedIds = targetSortedIds.filter(
      (id) => !annotationIds.includes(id)
    );

    // Add moved annotation IDs at the end
    targetSortedIds = [...targetSortedIds, ...annotationIds];

    await updateListing({
      id: targetListingId,
      sortedAnnotationIds: targetSortedIds,
    });

    // 4. Update annotation template listingId
    await updateAnnotationTemplate({
      ...annotationTemplate,
      listingId: targetListingId,
      projectId: targetListing.projectId,
    });

    // 5. Update all annotations and their entities
    for (const annotation of annotations) {
      // Update annotation listingId
      await db.annotations.update(annotation.id, {
        listingId: targetListingId,
      });

      // Update entity listingId if it exists
      // Entities are stored in db.entities (not in targetListing.table)
      if (annotation.entityId) {
        const entity = await db.entities.get(annotation.entityId);
        if (entity) {
          await updateEntity(
            entity.id,
            {
              listingId: targetListingId,
            },
            {
              listing: {
                id: targetListingId,
                table: "entities",
                projectId: targetListing.projectId,
              },
            }
          );
        }
      }
    }

    // Trigger updates
    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());
    dispatch(triggerEntitiesTableUpdate("entities"));
  };
}
