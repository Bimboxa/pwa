import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import db from "App/db/db";

export default function useDeleteAnnotation() {
  const dispatch = useDispatch();

  return async (annotationId) => {
    if (annotationId) {
      const annotation = await db.annotations.get(annotationId);
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
