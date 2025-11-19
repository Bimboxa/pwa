import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import db from "App/db/db";

export default function useDeleteAnnotation() {
  const dispatch = useDispatch();

  return async (annotationId) => {
    if (annotationId) {
      const annotation = await db.annotations.get(annotationId);
      if (!annotation) {
        console.warn("Annotation not found for deletion:", annotationId);
        return;
      }
      
      // Check if this annotation is a cutHost (either directly or from template)
      let annotationTemplateCutHost = false;
      if (annotation?.annotationTemplateId) {
        const annotationTemplate = await db.annotationTemplates.get(
          annotation.annotationTemplateId
        );
        annotationTemplateCutHost = annotationTemplate?.cutHost === true;
      }
      const isCutHost = annotation?.cutHost === true || annotationTemplateCutHost;

      console.log("[useDeleteAnnotation] deleting annotation", {
        annotationId,
        isCutHost,
        cutHost: annotation?.cutHost,
        annotationTemplateCutHost,
        baseMapId: annotation?.baseMapId,
      });

      // If this is a cutHost, remove all cuts that reference it
      if (isCutHost && annotation?.baseMapId) {
        // Find all annotations on the same baseMap that might have cuts
        const allAnnotations = await db.annotations
          .where("baseMapId")
          .equals(annotation.baseMapId)
          .toArray();

        console.log("[useDeleteAnnotation] found annotations on baseMap", allAnnotations.length);

        // Find annotations with cuts that reference this cutHost
        let updatedCount = 0;
        for (const ann of allAnnotations) {
          if (ann.cuts && Array.isArray(ann.cuts) && ann.cuts.length > 0) {
            const cutsBefore = ann.cuts.length;
            // Remove cuts that reference this cutHost
            const updatedCuts = ann.cuts.filter(
              (cut) => cut.cutHostId !== annotationId
            );

            // Only update if cuts were removed
            if (updatedCuts.length !== ann.cuts.length) {
              await db.annotations.update(ann.id, {
                cuts: updatedCuts.length > 0 ? updatedCuts : undefined,
              });
              updatedCount++;
              console.log("[useDeleteAnnotation] removed cuts from annotation", {
                annotationId: ann.id,
                cutsBefore,
                cutsAfter: updatedCuts.length,
              });
            }
          }
        }
        console.log("[useDeleteAnnotation] updated", updatedCount, "annotations with cuts");
      }

      if (annotation?.listingId) {
        const _listing = await db.listings.get(annotation.listingId);
        if (_listing?.sortedAnnotationIds) {
          const updates = {
            sortedAnnotationIds: _listing.sortedAnnotationIds.filter(
              (id) => id !== annotationId
            ),
          };
          await db.listings.update(annotation.listingId, updates);
        }
      } else {
        console.warn("debug_3110_annotation_no_listing", annotation);
      }
      await db.annotations.delete(annotationId);
    }
    dispatch(triggerAnnotationsUpdate());
  };
}
