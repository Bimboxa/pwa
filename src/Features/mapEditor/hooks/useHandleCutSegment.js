import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import splitPolylineAtSegment from "Features/mapEditor/utils/splitPolylineAtSegment";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

export default function useHandleCutSegment({ newEntity } = {}) {
  const dispatch = useDispatch();
  const createEntity = useCreateEntity();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const deleteAnnotations = useDeleteAnnotations();

  /**
   * Cut a polyline/strip annotation by removing the segment at segmentIndex.
   *
   * @param {string} annotationId - The annotation to cut
   * @param {number} segmentIndex - Index of the segment to remove
   */
  const handleCutSegment = async (annotationId, segmentIndex) => {
    const annotation = await db.annotations.get(annotationId);
    if (!annotation) {
      dispatch(setToaster({ message: "Annotation not found", isError: true }));
      return;
    }

    if (!["POLYLINE", "STRIP"].includes(annotation.type)) {
      dispatch(
        setToaster({
          message: "Cut segment only works on polylines and strips",
          isError: true,
        })
      );
      return;
    }

    // Single-segment open polyline: removing its only segment leaves nothing —
    // delete the annotation entirely (bulk path: listings, orphan points, …).
    if (!annotation.closeLine && (annotation.points?.length ?? 0) <= 2) {
      await deleteAnnotations([annotation.id]);
      dispatch(setToaster({ message: "Annotation supprimée", isError: false }));
      return;
    }

    const result = splitPolylineAtSegment(
      annotation.points,
      segmentIndex,
      annotation.closeLine
    );

    if (!result) {
      dispatch(
        setToaster({ message: "Cannot cut at this segment", isError: true })
      );
      return;
    }

    // Removing an end segment leaves a 1-point piece: drop it and keep the
    // valid piece instead of creating a degenerate annotation.
    const keep1 = result.piece1.length >= 2;
    const keep2 = Boolean(result.piece2 && result.piece2.length >= 2);

    if (keep1 && keep2) {
      // Open polyline split into two pieces
      await updateAnnotation({
        ...annotation,
        points: result.piece1,
        closeLine: false,
      });

      // Create a new entity + annotation for the second piece
      const entity = await createEntity(newEntity);
      const { id: _id, entityId: _eid, cuts: _cuts, ...hostProps } = annotation;
      await createAnnotation({
        ...hostProps,
        id: nanoid(),
        entityId: entity.id,
        points: result.piece2,
        closeLine: false,
      });
    } else {
      // Closed polyline → open (single reordered piece), or shrunk open
      // polyline when the removed segment was at an end.
      await updateAnnotation({
        ...annotation,
        points: keep1 ? result.piece1 : result.piece2,
        closeLine: false,
      });
    }

    dispatch(
      setToaster({ message: "Segment cut successfully", isError: false })
    );
  };

  return handleCutSegment;
}
