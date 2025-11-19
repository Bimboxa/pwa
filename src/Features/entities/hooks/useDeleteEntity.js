import db from "App/db/db";

import { useDispatch } from "react-redux";

import { setSelectedEntityId } from "../entitiesSlice";
import { triggerEntitiesUpdate } from "../entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

export default function useDeleteEntity() {
  const dispatch = useDispatch();

  const deleteEntity = async (entity) => {
    const listing = await db.listings.get(entity.listingId);

    const table = listing.table;

    // Get all annotations for this entity before deleting them
    const annotations = await db.annotations
      .where("entityId")
      .equals(entity.id)
      .toArray();

    // For each annotation, if it's a cutHost, remove related cuts
    for (const annotation of annotations) {
      if (annotation?.id) {
        // Check if this annotation is a cutHost (either directly or from template)
        let annotationTemplateCutHost = false;
        if (annotation?.annotationTemplateId) {
          const annotationTemplate = await db.annotationTemplates.get(
            annotation.annotationTemplateId
          );
          annotationTemplateCutHost = annotationTemplate?.cutHost === true;
        }
        const isCutHost = annotation?.cutHost === true || annotationTemplateCutHost;

        // If this is a cutHost, remove all cuts that reference it
        if (isCutHost && annotation?.baseMapId) {
          // Find all annotations on the same baseMap that might have cuts
          const allAnnotations = await db.annotations
            .where("baseMapId")
            .equals(annotation.baseMapId)
            .toArray();

          // Find annotations with cuts that reference this cutHost
          for (const ann of allAnnotations) {
            if (ann.cuts && Array.isArray(ann.cuts) && ann.cuts.length > 0) {
              // Remove cuts that reference this cutHost
              const updatedCuts = ann.cuts.filter(
                (cut) => cut.cutHostId !== annotation.id
              );

              // Only update if cuts were removed
              if (updatedCuts.length !== ann.cuts.length) {
                await db.annotations.update(ann.id, {
                  cuts: updatedCuts.length > 0 ? updatedCuts : undefined,
                });
              }
            }
          }
        }
      }
    }

    await db[table].delete(entity.id);
    await db.annotations.where("entityId").equals(entity.id).delete();

    dispatch(setSelectedEntityId(null));
    dispatch(triggerEntitiesUpdate());
    dispatch(triggerAnnotationsUpdate());
  };

  return deleteEntity;
}
